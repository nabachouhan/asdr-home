// userAuthMiddleware.js

import jwt from 'jsonwebtoken';
import express from 'express';
import cookieParser from 'cookie-parser';


const app = express();
app.use(cookieParser());

// ✅ Middleware function
const userAuthMiddleware = (req, res, next) => {
  const token = req.cookies.token;

  // ✅ Helper to decode token payload without verifying
  function parseJwt(token) {
    try {
      return JSON.parse(atob(token.split('.')[1]));
    } catch (error) {
            console.error(error);
      return null;
    }
  }

  const decodedToken = parseJwt(token);
  const currentTime = Math.floor(Date.now() / 1000);

  if (!token) {
    console.log("Token not found. Redirecting to login.");
    const data = { message: 'Login First!!', title: "Oops?", icon: "warning" };
    return res.status(401).json(data);
  }

  if (decodedToken?.exp < currentTime) {
    const data = { message: 'Session Expired Login Again!', title: "Oops?", icon: "warning" };
    console.log(data);
    return res.status(401).json(data);
  }

  try {
    const decoded = jwt.verify(token, process.env.secretKey);
    req.user = decoded;
    next();
  } catch (error) {
    console.error(error);
    const data = { message: 'Login First!!', title: "Oops?", icon: "warning" };
    return res.status(401).json(data);
  }
};

// ✅ Export as ES6 module
export default userAuthMiddleware;
