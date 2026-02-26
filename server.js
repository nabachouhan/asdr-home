import express from 'express';
import path from 'path';
import bodyParser from 'body-parser';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import helmet from "helmet";

import './src/db/databasecreate.js';
import './src/db/schema.js';

import router from './src/routes/index.js';
import adminAuthMiddleware from './src/middleware/adminAuth.js';
import cookieParser from 'cookie-parser';

// Setup for ES modules to get __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(cookieParser());

// 🔐 Serve protected folder only if authenticated
app.use('/admin-assets', adminAuthMiddleware, express.static(path.join(__dirname, 'admin-assets')));


const cspOptions = {
  useDefaults: true,
  directives: {
    defaultSrc: ["'self'"],
    
    scriptSrc: [
      "'self'",
      "https://cdn.jsdelivr.net",
      "https://cdnjs.cloudflare.com",
      "https://challenges.cloudflare.com",
      "https://www.youtube.com",
      "https://s.ytimg.com"
    ],

    styleSrc: [
      "'self'",
      "'unsafe-inline'",
      "https://fonts.googleapis.com",
      "https://cdn.jsdelivr.net",
      "https://cdnjs.cloudflare.com"
    ],

    fontSrc: [
      "'self'",
      "https://fonts.gstatic.com",
      "https://cdn.jsdelivr.net",
      "https://cdnjs.cloudflare.com"
    ],

    imgSrc: [
      "'self'",
      "data:",
      "https://i.ytimg.com",
      "https://s.ytimg.com",
      "https://www.google.com",
      "https:"
    ],

    frameSrc: [
      "'self'",
      "https://www.youtube.com",
      "https://www.youtube-nocookie.com",
      "https://challenges.cloudflare.com",
      "https://www.google.com"
    ],

    connectSrc: [
      "'self'",
      "https://cdn.jsdelivr.net",
      "https://cdnjs.cloudflare.com",
      "https://www.youtube.com"
    ],

    objectSrc: ["'none'"],
    upgradeInsecureRequests: [],
  },
};


app.use(helmet.contentSecurityPolicy(cspOptions));

// JWT Middleware
const jwtMiddleware = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (token) {
    jwt.verify(token, process.env.adminSecretKey, (err, decoded) => {
      if (err) {
        return res.status(401).send('Unauthorized');
      }
      req.user = decoded;
      next();
    });
  } else {
    next();
  }
};
app.use(jwtMiddleware);

// ✅ View engine setup for EJS
const viewpath = path.join(__dirname, 'templates/views');
app.set('view engine', 'ejs');
app.set('views', viewpath);

// Routes
app.use('/', router);

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`127.0.0.1:${PORT} listening on port ${PORT}`);
});
