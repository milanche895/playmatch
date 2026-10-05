const test = require('node:test');
const assert = require('node:assert/strict');
const { getReliabilityPenaltyPoints } = require('../src/server/utils/reliability');
const { levelFromXp, XP_PER_LEVEL } = require('../src/server/utils/gamification');
const { sanitizeGameIds } = require('../src/server/constants/games');
const { isEmailVerified, hashVerificationToken, createVerificationToken } = require('../src/server/utils/emailVerification');
const { calculateDistance } = require('../src/server/utils/notifications');
const { isParticipant, formatQuickMessage } = require('../src/server/utils/quickMessages');
const { getPublicUrl, getOAuthCallbackUrl } = require('../src/server/publicUrl');
const { describeSubscription, hasPushEndpoint } = require('../src/server/utils/pushNotifications');
const { getTrustBadge } = require('../src/lib/trustBadge');
const { formatPlayersCount } = require('../src/lib/matchPlayers');
const { createRateLimiter } = require('../src/server/middleware/rateLimit');
const { getRequiredSecret } = require('../src/server/utils/secrets');

test('reliability penalty is free at 2h, 10 points inside 2h, and 15 inside 1h', () => {
  assert.equal(getReliabilityPenaltyPoints(2), 0);
  assert.equal(getReliabilityPenaltyPoints(3), 0);
  assert.equal(getReliabilityPenaltyPoints(1), 10);
  assert.equal(getReliabilityPenaltyPoints(1.5), 10);
  assert.equal(getReliabilityPenaltyPoints(0.99), 15);
  assert.equal(getReliabilityPenaltyPoints(0), 15);
  assert.equal(getReliabilityPenaltyPoints(-1), 15);
});

test('level increases every 200 XP and never drops below 1', () => {
  assert.equal(XP_PER_LEVEL, 200);
  assert.equal(levelFromXp(0), 1);
  assert.equal(levelFromXp(199), 1);
  assert.equal(levelFromXp(200), 2);
  assert.equal(levelFromXp(-50), 1);
  assert.equal(levelFromXp('nope'), 1);
});

test('game ids are trimmed, deduped, and limited to known games', () => {
  assert.deepEqual(sanitizeGameIds([' football ', 'football', 'not-a-game', 12, 'chess']), ['football', 'chess']);
  assert.deepEqual(sanitizeGameIds('football'), []);
  assert.deepEqual(sanitizeGameIds(null), []);
});

test('local users need emailVerified; oauth providers count as verified', () => {
  assert.equal(isEmailVerified(null), false);
  assert.equal(isEmailVerified({ provider: 'local', emailVerified: false }), false);
  assert.equal(isEmailVerified({ provider: 'local', emailVerified: true }), true);
  assert.equal(isEmailVerified({ provider: 'google', emailVerified: false }), true);
});

test('verification token hash is sha256 and expires in about 24 hours', () => {
  assert.equal(
    hashVerificationToken('abc'),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
  );
  const created = createVerificationToken();
  assert.equal(created.hash, hashVerificationToken(created.rawToken));
  assert.equal(created.rawToken.length, 64);
  const ttl = created.expires.getTime() - Date.now();
  assert.ok(ttl > 23 * 60 * 60 * 1000);
  assert.ok(ttl <= 24 * 60 * 60 * 1000 + 5000);
});

test('distance is zero at the same point and about 111km per latitude degree', () => {
  assert.ok(calculateDistance(44.8, 20.4, 44.8, 20.4) < 0.001);
  const oneDegree = calculateDistance(0, 0, 1, 0);
  assert.ok(Math.abs(oneDegree - 111.19) < 1);
});

test('quick chat participant check and message shape', () => {
  const match = { players: [{ _id: 'u1' }, 'u2'] };
  assert.equal(isParticipant(match, 'u1'), true);
  assert.equal(isParticipant(match, 'u2'), true);
  assert.equal(isParticipant(match, 'u3'), false);
  assert.equal(isParticipant(null, 'u1'), false);

  const formatted = formatQuickMessage({
    _id: 'm1',
    text: 'Idem',
    isPreset: true,
    createdAt: '2026-01-01',
    userId: { _id: 'u1', name: 'Ana' },
  });
  assert.deepEqual(formatted.userId, { _id: 'u1', name: 'Ana' });
  assert.equal(formatted.isPreset, true);
  assert.equal(formatQuickMessage(null), null);
});

test('public url prefers CLIENT_URL and ignores the old split-backend callback port', () => {
  const prevClient = process.env.CLIENT_URL;
  const prevFacebook = process.env.FACEBOOK_CALLBACK_URL;
  try {
    process.env.CLIENT_URL = 'https://plejko.app/';
    assert.equal(getPublicUrl(), 'https://plejko.app');

    delete process.env.CLIENT_URL;
    process.env.FACEBOOK_CALLBACK_URL = 'http://localhost:5050/api/auth/facebook/callback';
    const url = getOAuthCallbackUrl(
      { headers: { host: 'plejko.app', 'x-forwarded-proto': 'https' }, protocol: 'http' },
      'facebook'
    );
    assert.equal(url, 'https://plejko.app/api/auth/facebook/callback');
  } finally {
    if (prevClient === undefined) delete process.env.CLIENT_URL;
    else process.env.CLIENT_URL = prevClient;
    if (prevFacebook === undefined) delete process.env.FACEBOOK_CALLBACK_URL;
    else process.env.FACEBOOK_CALLBACK_URL = prevFacebook;
  }
});

test('push subscription helper accepts only objects with an endpoint', () => {
  assert.equal(hasPushEndpoint(null), false);
  assert.equal(hasPushEndpoint({ keys: { p256dh: 'a', auth: 'b' } }), false);
  assert.equal(hasPushEndpoint({ endpoint: 'https://push.example/sub', keys: { p256dh: 'a', auth: 'b' } }), true);
  const described = describeSubscription({ endpoint: 'https://push.example/sub', keys: {} });
  assert.equal(described.endpointHost, 'push.example');
  assert.equal(described.hasAuth, false);
});

test('trust badge treats 90 as reliable, matching the backend unlock', () => {
  assert.equal(getTrustBadge(90).level, 'reliable');
  assert.equal(getTrustBadge(100).level, 'reliable');
  assert.equal(getTrustBadge(null).level, 'reliable');
  assert.equal(getTrustBadge(89).level, 'caution');
  assert.equal(getTrustBadge(70).level, 'caution');
  assert.equal(getTrustBadge(69).level, 'risky');
});

test('player count shows current, minimum, and optional maximum', () => {
  assert.equal(formatPlayersCount({ players: [{}, {}], minPlayers: 4, maxPlayers: 8 }), '2/4-8');
  assert.equal(formatPlayersCount({ players: [], playersNeeded: 6 }), '0/6');
});

test('auth rate limiter blocks the request after the configured maximum', () => {
  const limiter = createRateLimiter({ windowMs: 60_000, max: 2, message: 'stop' });
  const req = { ip: '203.0.113.5', headers: {} };
  const calls = [];
  const res = {
    status(code) {
      calls.push(code);
      return this;
    },
    json(body) {
      calls.push(body.message);
    },
  };

  limiter(req, res, () => calls.push('next'));
  limiter(req, res, () => calls.push('next'));
  limiter(req, res, () => calls.push('next'));

  assert.deepEqual(calls, ['next', 'next', 429, 'stop']);
});

test('production refuses to start auth with a missing secret', () => {
  const prevNodeEnv = process.env.NODE_ENV;
  const prevSecret = process.env.JWT_SECRET;
  try {
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;
    assert.throws(() => getRequiredSecret('JWT_SECRET', 'dev_secret'), /JWT_SECRET is required/);
    process.env.NODE_ENV = 'development';
    assert.equal(getRequiredSecret('JWT_SECRET', 'dev_secret'), 'dev_secret');
  } finally {
    if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevNodeEnv;
    if (prevSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = prevSecret;
  }
});
