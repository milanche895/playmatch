const Match = require('../models/Match');

const XP_PER_LEVEL = 200;
const XP_ATTENDEE = 50;
const XP_CREATOR = 80;
const CREATOR_CREDIT_BONUS = 1;
const REFERRAL_CREDIT_BONUS = 2;
const DEFAULT_STARTING_CREDITS = 3;

const BADGE_DEFS = {
  pouzdan_igrac: { id: 'pouzdan_igrac', name: 'Pouzdan Igrač' },
  lokalni_kapiten: { id: 'lokalni_kapiten', name: 'Lokalni Kapiten' },
  fer_plej: { id: 'fer_plej', name: 'Fer-Plej' }
};

function levelFromXp(xp) {
  return Math.floor(Math.max(0, Number(xp) || 0) / XP_PER_LEVEL) + 1;
}

function hasBadge(user, badgeId) {
  return (user.badges || []).some((b) => b.id === badgeId);
}

async function addBadgeIfMissing(userId, badgeId, User) {
  const user = await User.findById(userId).select('badges');
  if (!user || hasBadge(user, badgeId)) return false;
  await User.findByIdAndUpdate(userId, {
    $push: { badges: { id: badgeId, unlockedAt: new Date() } }
  });
  return true;
}

/**
 * Award XP and recalculate level for a single user.
 */
async function awardXp(userId, amount, User) {
  if (!userId || !amount || amount <= 0) return null;
  const user = await User.findById(userId).select('xp level badges reliabilityScore');
  if (!user) return null;

  const nextXp = (user.xp || 0) + amount;
  const nextLevel = levelFromXp(nextXp);
  user.xp = nextXp;
  user.level = nextLevel;
  await user.save();
  return user;
}

/**
 * Add credits (treats missing credits as DEFAULT_STARTING_CREDITS for legacy users).
 */
async function awardCredits(userId, amount, User) {
  if (!userId || !amount || amount === 0) return;
  await User.findByIdAndUpdate(userId, [
    {
      $set: {
        credits: {
          $max: [
            0,
            { $add: [{ $ifNull: ['$credits', DEFAULT_STARTING_CREDITS] }, amount] }
          ]
        }
      }
    }
  ]);
}

/**
 * On a referred user's first completed match, grant +2 credits to both users (once).
 */
async function maybeGrantReferralReward(userId, User) {
  if (!userId) return;

  const claimed = await User.findOneAndUpdate(
    {
      _id: userId,
      referredBy: { $exists: true, $ne: null },
      referralRewardGranted: { $ne: true }
    },
    { $set: { referralRewardGranted: true } },
    { new: true }
  ).select('referredBy');

  if (!claimed?.referredBy) return;

  await awardCredits(userId, REFERRAL_CREDIT_BONUS, User);
  await awardCredits(claimed.referredBy, REFERRAL_CREDIT_BONUS, User);
}

/**
 * Evaluate and unlock badges based on current stats.
 */
async function evaluateBadges(userId, User) {
  const user = await User.findById(userId).select('badges reliabilityScore');
  if (!user) return;

  if ((user.reliabilityScore ?? 100) >= 90) {
    await addBadgeIfMissing(userId, BADGE_DEFS.pouzdan_igrac.id, User);
  }

  const organizedCompleted = await Match.countDocuments({
    createdBy: userId,
    status: 'completed'
  });
  if (organizedCompleted >= 1) {
    await addBadgeIfMissing(userId, BADGE_DEFS.lokalni_kapiten.id, User);
  }

  const fairPlayAgg = await Match.aggregate([
    { $match: { 'ratings.ratedUserId': user._id } },
    { $unwind: '$ratings' },
    {
      $match: {
        'ratings.ratedUserId': user._id,
        'ratings.fairPlay': true
      }
    },
    { $count: 'count' }
  ]);
  const fairPlayCount = fairPlayAgg[0]?.count || 0;
  if (fairPlayCount >= 1) {
    await addBadgeIfMissing(userId, BADGE_DEFS.fer_plej.id, User);
  }
}

/**
 * Award match completion XP/credits once per match.
 * Attendees: +50 XP
 * Creator: +80 XP and +1 credit
 * Referral: +2 credits to referred user + referrer on first completed match
 * Idempotent via match.xpAwarded.
 */
async function awardMatchCompletionXp(match, User) {
  if (!match || match.xpAwarded) return { awarded: false };

  const creatorId = match.createdBy.toString();
  const playerIds = (match.players || []).map((p) => p.toString());
  const uniqueIds = [...new Set(playerIds)];

  for (const playerId of uniqueIds) {
    const amount = playerId === creatorId ? XP_CREATOR : XP_ATTENDEE;
    await awardXp(playerId, amount, User);
    await evaluateBadges(playerId, User);
    await maybeGrantReferralReward(playerId, User);
  }

  // Creator might not be in players[] — still award organizer XP
  if (!uniqueIds.includes(creatorId)) {
    await awardXp(creatorId, XP_CREATOR, User);
    await evaluateBadges(creatorId, User);
  }

  // Organizer credit bonus for completing the match
  await awardCredits(creatorId, CREATOR_CREDIT_BONUS, User);

  match.xpAwarded = true;
  await match.save();
  return { awarded: true };
}

module.exports = {
  XP_PER_LEVEL,
  XP_ATTENDEE,
  XP_CREATOR,
  CREATOR_CREDIT_BONUS,
  REFERRAL_CREDIT_BONUS,
  DEFAULT_STARTING_CREDITS,
  BADGE_DEFS,
  levelFromXp,
  awardXp,
  awardCredits,
  evaluateBadges,
  maybeGrantReferralReward,
  awardMatchCompletionXp
};
