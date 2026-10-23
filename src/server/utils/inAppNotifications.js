const Notification = require('../models/Notification');
const Match = require('../models/Match');
const Field = require('../models/Field');
const User = require('../models/User');
const { shouldSendTeamReady } = require('./matchLifecycle');
const { sendPushNotifications, hasPushEndpoint } = require('./pushNotifications');
const { formatRatePlayersMessage } = require('../../lib/teamReadyMessage');

const REMINDER_WINDOW_MS = 2 * 60 * 60 * 1000;
const FEED_RETENTION_DAYS = 30;

async function resolveLocationName(match) {
  if (match.isInformal) return match.informalLocation?.name || 'Privatni teren';
  const field = match.fieldId;
  if (field && field.name) return field.name;
  const fieldId = field && field._id ? field._id : field;
  if (!fieldId) return 'Nepoznat teren';
  const doc = await Field.findById(fieldId).select('name');
  return doc?.name || 'Nepoznat teren';
}

/**
 * Create one in-app notification per recipient for a match event.
 * Never throws — the feed must not break the main request.
 * @param {object} match mongoose match doc (fieldId may be populated or an id)
 * @param {string} type one of NOTIFICATION_TYPES
 * @param {Array<string|object>} userIds recipients
 * @param {{ excludeUserId?: string, playerCount?: number, fieldId?: string }} [opts]
 */
async function notifyUsers(match, type, userIds, opts = {}) {
  try {
    const exclude = opts.excludeUserId ? String(opts.excludeUserId) : null;
    const recipients = [...new Set((userIds || []).map((id) => String(id._id || id)))].filter(
      (id) => id && id !== exclude
    );
    if (recipients.length === 0) return [];

    const locationName = await resolveLocationName(match);
    const docs = recipients.map((userId) => {
      const doc = {
        userId,
        type,
        matchId: match._id,
        sport: match.sport,
        locationName,
        matchDateTime: match.dateTime,
      };
      if (opts.playerCount != null) doc.playerCount = opts.playerCount;
      if (opts.fieldId) doc.fieldId = opts.fieldId;
      return doc;
    });
    return await Notification.insertMany(docs);
  } catch (err) {
    console.error('[Notifications] Failed to create notifications:', err.message);
    return [];
  }
}

/**
 * Reminder for players of matches that start within the next 2 hours.
 * Idempotent: one reminder per player per match.
 */
async function processMatchReminders() {
  try {
    const now = new Date();
    const matches = await Match.find({
      status: { $in: ['open', 'full'] },
      courtApproval: { $ne: 'rejected' },
      dateTime: { $gt: now, $lte: new Date(now.getTime() + REMINDER_WINDOW_MS) },
    });

    let created = 0;
    for (const match of matches) {
      const existing = await Notification.find({ matchId: match._id, type: 'reminder' }).select('userId');
      const already = new Set(existing.map((n) => String(n.userId)));
      const pending = match.players.filter((p) => !already.has(String(p)));
      if (pending.length === 0) continue;
      const docs = await notifyUsers(match, 'reminder', pending);
      created += docs.length;
    }
    return { created };
  } catch (err) {
    console.error('[Notifications] Reminder job failed:', err.message);
    return { created: 0 };
  }
}

/** Drop old feed entries so the collection stays small. */
async function pruneOldNotifications() {
  try {
    const cutoff = new Date(Date.now() - FEED_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    await Notification.deleteMany({ createdAt: { $lt: cutoff } });
  } catch (err) {
    console.error('[Notifications] Prune failed:', err.message);
  }
}

function fieldIdOf(match) {
  const field = match?.fieldId;
  if (!field) return null;
  return field._id || field;
}

/**
 * In-app "Ekipa je spremna" for the court owner.
 * No-op for informal matches, fields without an owner, and matches that are
 * already approved or rejected. Caller must invoke this only on open -> full.
 */
async function notifyMatchBecameReady(match) {
  try {
    const fieldId = fieldIdOf(match);
    let courtOwner = match?.fieldId && match.fieldId.courtOwner ? match.fieldId.courtOwner : null;
    if (fieldId && !courtOwner && !match.isInformal) {
      const field = await Field.findById(fieldId).select('courtOwner');
      courtOwner = field?.courtOwner || null;
    }
    if (!shouldSendTeamReady(match, courtOwner)) return [];
    return await notifyUsers(match, 'team_ready', [courtOwner], {
      playerCount: (match.players || []).length,
      fieldId,
    });
  } catch (err) {
    console.error('[Notifications] team_ready failed:', err.message);
    return [];
  }
}

/**
 * Shared open -> full side effects: players get match_full, owner gets team_ready
 * when the match still needs court approval.
 */
async function notifyMatchBecameFull(match) {
  const [fullDocs] = await Promise.all([
    notifyUsers(match, 'match_full', match.players),
    notifyMatchBecameReady(match),
  ]);
  return fullDocs;
}

async function sendRatePlayersPush(userIds, match, locationName) {
  const users = await User.find({
    _id: { $in: userIds },
    notificationEnabled: { $ne: false },
    pushSubscription: { $exists: true, $ne: null },
  }).select('pushSubscription');

  const subscriptions = users
    .filter((u) => hasPushEndpoint(u.pushSubscription))
    .map((u) => u.pushSubscription);
  if (subscriptions.length === 0) return;

  const result = await sendPushNotifications(subscriptions, {
    title: 'Oceni saigrače',
    body: formatRatePlayersMessage({ locationName }),
    url: `/matches/${match._id}`,
    matchId: match._id.toString(),
    image: '/icons/icon-192.png',
  });

  for (const expiredSub of result.expiredSubscriptions || []) {
    if (expiredSub.endpoint) {
      await User.updateMany(
        { 'pushSubscription.endpoint': expiredSub.endpoint },
        { $unset: { pushSubscription: 1 } }
      );
    }
  }
}

/**
 * Ask the match creator to rate the other players once a match is completed.
 * Skipped when nobody else played. Idempotent: one rate_players entry per match.
 */
async function notifyPlayersToRate(match) {
  try {
    const creatorId = String(match.createdBy?._id || match.createdBy || '');
    const players = [...new Set((match.players || []).map((p) => String(p._id || p)))].filter(Boolean);
    const others = players.filter((id) => id !== creatorId);
    if (!creatorId || others.length === 0) return [];

    const existing = await Notification.find({ matchId: match._id, type: 'rate_players', userId: creatorId }).select('userId');
    if (existing.length > 0) return [];
    const pending = [creatorId];

    const docs = await notifyUsers(match, 'rate_players', pending);
    if (docs.length === 0) return [];
    const locationName = docs[0]?.locationName;
    try {
      await sendRatePlayersPush(pending, match, locationName);
    } catch (err) {
      console.error('[Notifications] rate_players push failed:', err.message);
    }
    return docs;
  } catch (err) {
    console.error('[Notifications] rate_players failed:', err.message);
    return [];
  }
}

/** Clear the rate prompt once this player has rated everyone on the match. */
async function markRateNotificationRead(userId, matchId) {
  try {
    await Notification.updateMany(
      { userId, matchId, type: 'rate_players', readAt: { $exists: false } },
      { $set: { readAt: new Date() } }
    );
  } catch (err) {
    console.error('[Notifications] mark rate read failed:', err.message);
  }
}

module.exports = {
  notifyUsers,
  notifyMatchBecameReady,
  notifyMatchBecameFull,
  notifyPlayersToRate,
  markRateNotificationRead,
  processMatchReminders,
  pruneOldNotifications,
};
