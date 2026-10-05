function debugLog(...args) {
  if (process.env.NODE_ENV !== 'production') {
    console.log(...args);
  }
}

module.exports = { debugLog };
