// userAuthMiddleware.js

import jwt from 'jsonwebtoken';

// ✅ Middleware function
const userAuthMiddleware = (req, res, next) => {
  const token = req.cookies.token;

  // ✅ Check token existence FIRST (before parsing)
  if (!token) {
    console.log("Token not found. Redirecting to login.");
    const data = { message: 'Login First!!', title: "Oops?", icon: "warning" };
    return res.status(401).json(data);
  }

  // ✅ Helper to decode token payload without verifying
  function parseJwt(tkn) {
    try {
      return JSON.parse(Buffer.from(tkn.split('.')[1], 'base64').toString());
    } catch (error) {
      return null;
    }
  }

  const decodedToken = parseJwt(token);
  const currentTime = Math.floor(Date.now() / 1000);

  if (!decodedToken || decodedToken.exp < currentTime) {
    const data = { message: 'Session Expired Login Again!', title: "Oops?", icon: "warning" };
    return res.status(401).json(data);
  }

  try {
    const decoded = jwt.verify(token, process.env.secretKey);
    req.user = decoded;
    next();
  } catch (error) {
    console.error("Token verification failed:", error.message);
    const data = { message: 'Login First!!', title: "Oops?", icon: "warning" };
    return res.status(401).json(data);
  }
};

// ✅ Export as ES6 module
export default userAuthMiddleware;
