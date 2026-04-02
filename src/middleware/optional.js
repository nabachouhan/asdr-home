// optionalAuth.js

import jwt from 'jsonwebtoken';

// Middleware to optionally decode user info from JWT token
const optionalAuth = (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    // No token — proceed as guest
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.secretKey);
    req.user = decoded;
    next();
  } catch (error) {
    // If token is invalid, proceed as guest (don't block)
    console.log("⚠️ Invalid token (optionalAuth) — proceeding as guest");
    next();
  }
};

export default optionalAuth;

