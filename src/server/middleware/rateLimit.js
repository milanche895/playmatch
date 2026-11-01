// Real client IP. On Vercel every request reaches the function from the platform's
// proxy, so req.ip would be the same for everyone; Vercel overwrites these headers
// with the caller's address, so they can't be spoofed by the client.
function clientIp(req) {
  const headers = req.headers || {};
  const forwarded = headers['x-vercel-forwarded-for'] || headers['x-real-ip'] || headers['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return req.ip || (req.socket && req.socket.remoteAddress) || 'unknown';
}

// In-memory limiter. On serverless each warm instance keeps its own counters, so
// this slows down brute force but is not a hard global limit.
function createRateLimiter({ windowMs, max, message }) {
  const hits = new Map();

  return function rateLimit(req, res, next) {
    const now = Date.now();
    // Separate bucket per route, so e.g. failed logins don't block email verification
    const key = `${clientIp(req)}|${req.baseUrl || ''}${req.path || ''}`;
    const recent = (hits.get(key) || []).filter((ts) => now - ts < windowMs);

    if (recent.length >= max) {
      return res.status(429).json({
        message: message || 'Previše zahteva. Pokušaj ponovo za nekoliko minuta.',
      });
    }

    recent.push(now);
    hits.set(key, recent);

    if (hits.size > 5000) {
      for (const [bucketKey, timestamps] of hits) {
        const fresh = timestamps.filter((ts) => now - ts < windowMs);
        if (fresh.length === 0) hits.delete(bucketKey);
        else hits.set(bucketKey, fresh);
      }
    }

    return next();
  };
}

const authRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Previše pokušaja. Sačekaj par minuta pa pokušaj ponovo.',
});

module.exports = { createRateLimiter, authRateLimit, clientIp };
