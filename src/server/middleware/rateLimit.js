function createRateLimiter({ windowMs, max, message }) {
  const hits = new Map();

  return function rateLimit(req, res, next) {
    const now = Date.now();
    const key = req.ip || req.headers['x-forwarded-for'] || 'unknown';
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

module.exports = { createRateLimiter, authRateLimit };
