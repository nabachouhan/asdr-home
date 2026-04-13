import express from 'express';
import path from 'path';
import bodyParser from 'body-parser';
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
      "https://s.ytimg.com",
      "https://code.jquery.com",
      "https://stackpath.bootstrapcdn.com",
      "https://maxcdn.bootstrapcdn.com",
      "https://player.vimeo.com",
      "https://ik.imagekit.io"
    ],

    styleSrc: [
      "'self'",
      "'unsafe-inline'",
      "https://fonts.googleapis.com",
      "https://cdn.jsdelivr.net",
      "https://cdnjs.cloudflare.com",
      "https://ik.imagekit.io"
    ],

    fontSrc: [
      "'self'",
      "https://fonts.gstatic.com",
      "https://cdn.jsdelivr.net",
      "https://cdnjs.cloudflare.com",
      "https://ik.imagekit.io"
    ],

    imgSrc: [
      "'self'",
      "data:",
      "https://i.ytimg.com",
      "https://s.ytimg.com",
      "https://www.google.com",
      "https://ik.imagekit.io"
    ],

    mediaSrc: [
      "'self'",
      "https://ik.imagekit.io"
    ],

    frameSrc: [
      "'self'",
      "https://www.youtube.com",
      "https://www.youtube-nocookie.com",
      "https://challenges.cloudflare.com",
      "https://www.google.com",
      "https://player.vimeo.com",
      "https://ik.imagekit.io"
    ],

    connectSrc: [
      "'self'",
      "https://cdn.jsdelivr.net",
      "https://cdnjs.cloudflare.com",
      "https://www.youtube.com",
      "https://player.vimeo.com",
      "https://ik.imagekit.io"
    ],

    objectSrc: ["'none'"],
    upgradeInsecureRequests: [],
  },
};


// 🔐 Enable Helmet security headers (CSP, HSTS, X-Frame-Options, etc.)
app.use(helmet({
  contentSecurityPolicy: cspOptions,
  crossOriginEmbedderPolicy: false, // allow loading cross-origin resources (CDNs)
}));

// ✅ View engine setup for EJS
const viewpath = path.join(__dirname, 'templates/views');
app.set('view engine', 'ejs');
app.set('views', viewpath);

// Routes
app.use('/', router);

// Start the server
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

app.listen(PORT, HOST, () => {
  console.log(`${HOST}:${PORT} listening on port ${PORT}`);
});

