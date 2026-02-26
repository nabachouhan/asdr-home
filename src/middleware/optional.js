// optionalAuth.js

// Import required modules
import jwt from 'jsonwebtoken';
import express from 'express';
import cookieParser from 'cookie-parser';

// Create an express app instance (only if needed — normally done in server.js)
const app = express();

// Apply cookie-parser middleware to read cookies from requests
app.use(cookieParser());

// Middleware to optionally decode user info from JWT token
const optionalAuth = async (req, res, next) => {
  // Read token from cookies
  const token = req.cookies.token;

  // Helper function to parse JWT payload without verifying it
  function parseJwt(token) {
    try {
      return JSON.parse(atob(token.split('.')[1]));
    } catch (error) {
            console.error(error);
      return null;
    }
  }

  // Decode token to check its expiration (optional, not used here but could be useful)
  const decodedToken = parseJwt(token);
  const currentTime = Math.floor(Date.now() / 1000);

  try {
    // Try to verify the token using your secret key
    const decoded = jwt.verify(token, process.env.secretKey);

    // If successful, attach user info to request object
    req.user = decoded;
    console.log("✅ Valid token detected (optionalAuth)");
    next();
  } catch (error) {
    console.error(error);
    // If token is missing or invalid, skip attaching user and move on
    console.log("⚠️ Invalid or missing token (optionalAuth) — proceeding as guest");
    next(); // Don't block the request, just don't set `req.user`
  }
};

// Export middleware as ES6 module
export default optionalAuth;
