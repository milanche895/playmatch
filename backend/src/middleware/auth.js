const jwt = require('jsonwebtoken');

function auth(required = true) {
  return (req, res, next) => {
    try {
      // Try to get token from cookie first, then from Authorization header
      let token = req.cookies?.token;
      
      // If no cookie token, try Authorization header (Bearer token)
      if (!token && req.headers.authorization) {
        const authHeader = req.headers.authorization;
        if (authHeader.startsWith('Bearer ')) {
          token = authHeader.substring(7);
        }
      }
      
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


