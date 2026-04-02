// adminAuthMiddleware.js

import jwt from 'jsonwebtoken';

// Admin authentication middleware
const adminAuthMiddleware = (req, res, next) => {
  const token = req.cookies.token;

  // Helper function to decode JWT payload (without verifying signature)
  function parseJwt(tkn) {
    try {
      return JSON.parse(Buffer.from(tkn.split('.')[1], 'base64').toString());
    } catch (error) {
      return null;
    }
  }

  // If token is missing, redirect to login
  if (!token) {
    console.log("Admin token not found. Redirecting to login.");
    return res.redirect('/admin');
  }

  // Decode token to get expiration time
  const decodedToken = parseJwt(token);
  const currentTime = Math.floor(Date.now() / 1000);

  // If decoding fails or token is expired, redirect
  if (!decodedToken || decodedToken.exp < currentTime) {
    return res.redirect('/admin?expired=true');
  }

  try {
    // Verify token signature using secret key
    const decoded = jwt.verify(token, process.env.adminSecretKey);
    req.user = decoded;
    next();
  } catch (err) {
    console.log("Admin token verification failed:", err.message);
    return res.redirect('/admin');
  }
};

export default adminAuthMiddleware;

