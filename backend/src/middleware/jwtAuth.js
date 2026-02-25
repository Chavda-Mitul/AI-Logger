/**
 * JWT Authentication Middleware
 *
 * Used to protect dashboard API routes (not the SDK logging endpoint).
 * Reads the Authorization: Bearer <token> header.
 */
const jwt = require('jsonwebtoken');

function requireJwt(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.sub;   // user UUID
    req.userEmail = payload.email;
    req.user = { 
      userId: payload.sub, 
      email: payload.email, 
      orgId: payload.orgId 
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

module.exports = { requireJwt };
