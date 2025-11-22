const jwt = require('jsonwebtoken');

function auth(required = true) {
  return (req, res, next) => {
    try {
      const token = req.cookies?.token;
      if (!token) {
        if (required) return res.status(401).json({ message: 'Not authenticated' });
        req.user = null;
        return next();
      }
      const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
      req.user = { id: payload.id };
      return next();
    } catch (err) {
      if (required) return res.status(401).json({ message: 'Invalid token' });
      req.user = null;
      return next();
    }
  };
}

module.exports = auth;


