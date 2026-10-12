function getRequiredSecret(envName, devFallback) {
  const value = (process.env[envName] || '').trim();
  if (value) return value;
  if (process.env.NODE_ENV === 'production') {
    const err = new Error(`${envName} is required in production`);
    err.code = 'MISSING_SECRET';
    throw err;
  }
  return devFallback;
}

module.exports = { getRequiredSecret };
