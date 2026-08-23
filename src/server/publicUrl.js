function requestOrigin(req) {
  if (!req) return null;
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (!host) return null;
  return `${String(proto).split(',')[0].trim()}://${String(host).split(',')[0].trim()}`;
}

function getPublicUrl(req) {
  if (process.env.CLIENT_URL) {
    return process.env.CLIENT_URL.replace(/\/$/, '');
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  const origin = requestOrigin(req);
  if (origin) return origin;

  return 'http://localhost:3000';
}

function getOAuthCallbackUrl(req, provider) {
  const envKey = provider === 'facebook' ? 'FACEBOOK_CALLBACK_URL' : 'GOOGLE_CALLBACK_URL';
  const configured = (process.env[envKey] || '').trim();
  // Ignore leftover split-backend port from older local setups.
  if (configured && !/localhost:5050/i.test(configured)) {
    return configured.replace(/\/$/, '');
  }

  const origin = requestOrigin(req) || getPublicUrl(req);
  return `${origin}/api/auth/${provider}/callback`;
}

module.exports = { getPublicUrl, getOAuthCallbackUrl };
