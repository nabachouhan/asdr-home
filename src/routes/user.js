
// ✅ Importing necessary modules

import express from 'express';
const router = express.Router();
import nodemailer from 'nodemailer';
import bodyParser from 'body-parser';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import validator from 'validator';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import passwordValidator from 'password-validator';

import { poolUser } from "../db/connection.js";
import userAuthMiddleware from '../middleware/userAuth.js';
import rateLimit,{ ipKeyGenerator } from "express-rate-limit";
import sharp from "sharp";
import crypto from 'crypto';

// ✅ Create password validation schema using `password-validator`
const schema = new passwordValidator();

// ✅ Middleware configuration
router.use(cookieParser());
router.use(bodyParser.json());
router.use(bodyParser.urlencoded({ extended: true }));

// ✅ Email transporter configuration using Gmail SMTP
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // STARTTLS
  requireTLS: true, // Optional but recommended
  auth: {
    user: process.env.email,
    pass: process.env.appw,
  },
});

// ✅ Helper: Run middleware manually inside async routes
function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}


 // ✅ Secure OTP Generator (using crypto for strong randomness)
function generateSecureOTP(length) {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let otp = '';
  const randomBytes = crypto.randomBytes(length);
  
  for (let i = 0; i < length; i++) {
    otp += charset[randomBytes[i] % charset.length];
  }

  return otp;
}

// ✅ Custom rate limiter to prevent brute force/abuse (10 reqs / 5 minutes)
const customLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3,
  handler: (req, res) => {
    // This will be called if limit is exceeded
    return res.status(429).json({
      status: 429,
      error: "Too many requests. Try again in 5 minutes.",
      message:"Too many requests. Try again in 5 minutes.",
      icon:"warning"
    });
  },
  keyGenerator: ipKeyGenerator,  // ✅ Safe for IPv4 + IPv6
//   skip: () => true, // skip by default so it doesn’t auto-run
});

// ✅ GET Routes
router.get('/', async (req, res) => {
  res.render('userRegister', {
    pageTitle: 'Register',
  });
});

// ✅ GET Routes
router.get('/login', (req, res) => {
    // Your OpenLayers logic here
    res.render("userLogin",{
        pageTitle:"Login"
    });
    
});

// ✅ GET Routes
router.get('/forgot', (req, res) => {
    // Your OpenLayers logic here
    res.render("userForgot",{
        pageTitle:"Update Password"
    });

});

// ✅ Multer setup for handling file uploads (e.g., ID proof)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/')
    },
    filename: function (req, file, cb) {
        const uniqueName = crypto.randomUUID();
        cb(null, uniqueName + path.extname(file.originalname)) // Appending extension
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
    fileSize: 5 * 1024 * 1024 //  Max 5 MB per file
  }
});


// ✅ User Registration Route
// Refactored User Registration Route (reduced cognitive complexity)
router.post('/', upload.single('id_proof'), async (req, res) => {
  const action = req.body.submit; // expected: "GetOTP", "Verify", "Register"
  const TEMP_FILE = req.file && req.file.path;

  // ----- Helpers -----
  const cleanupFiles = () => {
    try {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
        console.log(`Deleted uploaded file: ${req.file.path}`);
      } else {
        console.log(`Deleted path not found: ${req.file && req.file.path}`);
      }
    } catch (err) {
      console.error(`Cleanup error: ${err}`);
    }
  };

  const getDbClient = async () => {
    const client = await poolUser.connect();
    return client;
  };

  const isWithinLastFiveMinutes = (timeValue) => {
    if (!timeValue) return false;
    const currentTime_ms = Date.now();
    const FIVE_MINUTES_MS = 5 * 60 * 1000;
    const startTime_ms = currentTime_ms - FIVE_MINUTES_MS;
    const timeA_ms = new Date(timeValue).getTime();
    return timeA_ms > startTime_ms && timeA_ms <= currentTime_ms;
  };

  const validateIndianPhoneNumber = (mobile) => /^[6-9]\d{9}$/.test(mobile);

  const validatePasswordDetails = (password) => {
    // schema is assumed to be defined in surrounding scope as in your original code
    return schema.validate(password, { details: true });
  };

  // Helper to send JSON response and always cleanup temp file on errors when needed
  const sendJson = (status, payload, doCleanup = false) => {
    if (doCleanup) cleanupFiles();
    return res.status(status).json(payload);
  };

  // ----- (1) SEND OTP -----
  const handleSendOTP = async () => {
    const email = req.body.email;
    if (!validator.isEmail(email)) {
      return sendJson(400, { message: 'Please enter valid email', title: "Alert", icon: "danger" });
    }

    let client;
    try {
      client = await getDbClient();
      const regresult = await client.query(`SELECT email FROM registered WHERE email = $1`, [email]);

      if (regresult.rows.length !== 0) {
        return sendJson(400, { message: 'Email already registered', title: "Alert", icon: "warning" }, true);
      }

      // Apply rate limiter middleware
      try {
        await runMiddleware(req, res, customLimiter);
        if (res.headersSent) return; // limiter blocked
      } catch (err) {
        console.error('Limiter middleware error:', err);
        return sendJson(500, { message: 'Rate limiter failure', title: "Error", icon: "danger" });
      }

      const otp = generateSecureOTP(8);

      await client.query(`DELETE FROM emailotp WHERE email = $1`, [email]);
      await client.query(`INSERT INTO emailotp (email, otp) VALUES ($1, $2)`, [email, otp]);
      client.release();

      // send mail
      await transporter.sendMail({
        from: process.env.email,
        to: email,
        subject: "🔐 ASSAM-SDR | OTP Verification",
        html: `
            <div style="
              font-family: Arial, sans-serif;
              background: #f5f7fa;
              padding: 20px;
              border-radius: 10px;
              max-width: 500px;
              margin: auto;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            ">
              <h2 style="color: #007bff; text-align:center;">
                ASSAM-SDR - OTP Verification
              </h2>
              <p style="font-size: 16px; color: #333;">
                Dear User,
              </p>
              <p style="font-size: 16px; color: #333;">
                Use the following One Time Password (OTP) to complete your verification process on the 
                <strong>ASSAM-SDR</strong> platform.
              </p>
              <div style="
                background: #007bff;
                color: white;
                font-size: 24px;
                font-weight: bold;
                letter-spacing: 2px;
                text-align: center;
                padding: 12px;
                border-radius: 8px;
                margin: 20px 0;
              ">
                ${otp}
              </div>
              <p style="font-size: 14px; color: #555;">
                This OTP is valid for 5 minutes. Please do not share it with anyone for security reasons.
              </p>
              <p style="font-size: 14px; color: #555;">
                Regards,<br>
                <strong>Assam State Space Application Centre (ASSAC)</strong><br>
                <em>Department of Science & Technology, Govt. of Assam</em>
              </p>
            </div>
          `
      });

      return sendJson(200, { message: 'OTP sent successfully', title: "Sent", icon: "success" });
    } catch (err) {
      console.error('Error in sending OTP:', err);
      if (client) client.release();
      return sendJson(500, { message: 'something went wrong, Try again!', title: "Error", icon: "danger" }, true);
    }
  };

  // ----- (2) VERIFY OTP -----
  const handleVerifyOTP = async () => {
    const email = req.body.email;
    const clientotp = req.body.otp;

    if (!email || !clientotp) {
      return sendJson(400, { message: 'Fill The Fields Email and OTP First', title: "Alert", icon: "warning" });
    }

    let client;
    try {
      client = await getDbClient();
      const result = await client.query(`SELECT otp, time FROM emailotp WHERE email = $1`, [email]);

      if (!result.rows.length) {
        return sendJson(400, { message: 'No OTP found. Please request OTP first', title: "Alert", icon: "warning" });
      }

      const { otp: dbotp, time } = result.rows[0];
      const storedOtp = dbotp.toString();

      if (!isWithinLastFiveMinutes(time)) {
        return sendJson(400, { message: 'OTP Expired', title: "Alert", icon: "danger" });
      }

      if (clientotp != storedOtp) {
        return sendJson(400, { message: 'Invalid OTP', title: "Alert", icon: "danger" });
      }

      // Move email to verifiedemails (replace previous)
      await client.query(`DELETE FROM verifiedemails WHERE email = $1`, [email]);
      await client.query(`INSERT INTO verifiedemails (email) VALUES ($1)`, [email]);
      client.release();

      return sendJson(200, { message: 'OTP verified successfully', title: "Verified", icon: "success" });
    } catch (err) {
      console.error('Error in OTP verification:', err);
      if (client) client.release();
      return sendJson(500, { message: 'Something Went Wrong, Try again!', title: "Error", icon: "danger" });
    }
  };

  // ----- (3) REGISTER USER -----
  const handleRegister = async () => {
    // destructure safely
    const {
      first_name, last_name, mobile, organization, department,
      designation, email, user_type, about, password, re_password
    } = req.body;

    // Basic field checks
    if (!first_name || !last_name || !mobile || !organization || !department ||
        !designation || !email || !user_type || !about || !password) {
      return sendJson(400, { message: 'All fields are required', title: "Warning", icon: "warning" }, true);
    }

    if (!validateIndianPhoneNumber(mobile)) {
      return sendJson(400, { message: 'Enter Valid Phone number!', title: "Warning", icon: "warning" }, true);
    }

    if (!req.file || !fs.existsSync(req.file.path)) {
      return sendJson(400, { message: 'Upload Valid Id proof', title: "Alert", icon: "warning" }, true);
    }

    if (password !== re_password) {
      return sendJson(400, { message: 'Password Mismatch', title: "Alert", icon: "warning" }, true);
    }

    const pwValidation = validatePasswordDetails(password);
    if (pwValidation.length !== 0) {
      return sendJson(400, {
        message: 'Minimum length 8 || Must have uppercase letters || Must have lowercase letters || Must have at least 2 digits || Should not have spaces || Must have at least one special character',
        title: "Password criteria",
        icon: "warning"
      }, true);
    }

    let client;
    try {
      client = await getDbClient();

      // Ensure OTP exists and is valid (you used emailotp for verification earlier)
      const otpresult = await client.query(`SELECT otp, time FROM emailotp WHERE email = $1`, [email]);
      if (!otpresult.rows.length) {
        return sendJson(400, { message: 'Verify OTP first', title: "Alert", icon: "danger" }, true);
      }

      const { otp: dbotp, time } = otpresult.rows[0];
      const storedOtp = dbotp.toString();
      const clientotp = req.body.otp;

      if (clientotp != storedOtp || !isWithinLastFiveMinutes(time)) {
        return sendJson(400, { message: 'Verify OTP first', title: "Alert", icon: "danger" }, true);
      }

      // Check email duplication
      const regresult = await client.query(`SELECT * FROM registered WHERE email = $1`, [email]);
      if (regresult.rows.length !== 0) {
        return sendJson(400, { message: 'Email already registered', title: "Alert", icon: "warning" }, true);
      }

      // Read id_proof buffer
      const id_proof = fs.readFileSync(req.file.path);
      const registereddate = new Date();

      // Save a permanent copy (strip metadata using sharp)
      const tempPath = req.file.path;
      const permanentFolder = "idcards/";
      const newFileName = crypto.randomUUID() + path.extname(req.file.originalname);
      const finalPath = path.join(permanentFolder, newFileName);

      await sharp(tempPath).withMetadata({}).toFile(finalPath);

      const hash_pw = bcrypt.hashSync(password, 10);
      const query = `
        INSERT INTO registered (first_name, last_name, mobile, organization, department, designation, email, user_type, about, registereddate, password, id_proof)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `;
      const values = [
        first_name, last_name, mobile, organization, department,
        designation, email, user_type, about, registereddate, hash_pw, id_proof
      ];

      await client.query(query, values);
      client.release();

      cleanupFiles(); // remove temporary upload
      return sendJson(200, { message: 'You Are Registered Successfully', title: "Registered", icon: "success", redirect: "/" });
    } catch (err) {
      console.error('Error inserting data:', err);
      if (client) client.release();
      cleanupFiles();
      return sendJson(500, { message: 'Something Went Wrong! try again', title: "Wrong", icon: "danger" });
    }
  };

  // ----- Route dispatch -----
  console.log(action);
  
  try {
    if (action === 'GetOTP') {
      return await handleSendOTP();
    }

    if (action === 'validate') {
      return await handleVerifyOTP();
    }

    if (action === 'Register') {
      return await handleRegister();
    }

    // Unknown action
    return sendJson(400, { message: 'Unknown action', title: "Error", icon: "danger" });
  } catch (err) {
    console.error('Unhandled error in registration route:', err);
    cleanupFiles();
    return sendJson(500, { message: 'Server error', title: "Error", icon: "danger" });
  }
});



// ✅ User Login Route
// ✅ Refactored — User Login Route (reduced cognitive complexity, same flow)
router.post('/login', upload.single('id_proof'), async (req, res) => {
  const { email, otp, password } = req.body;
  const action = req.body.submit; // expected: "GetOTP" or "login"

  // ----- Helpers -----
  const getDbClient = async () => {
    const client = await poolUser.connect();
    return client;
  };

  const isWithinLastFiveMinutes = (timeValue) => {
    if (!timeValue) return false;
    const currentTime_ms = Date.now();
    const FIVE_MINUTES_MS = 5 * 60 * 1000;
    const startTime_ms = currentTime_ms - FIVE_MINUTES_MS;
    const timeA_ms = new Date(timeValue).getTime();
    return timeA_ms > startTime_ms && timeA_ms <= currentTime_ms;
  };

  const sendJson = (status, payload) => {
    return res.status(status).json(payload);
  };

  // ----- (1) SEND OTP -----
  const handleSendOTP = async () => {
    try {
      if (!email) {
        return sendJson(400, { message: 'Email required', title: "Warning", icon: "warning" });
      }

      let client;
      try {
        client = await getDbClient();
        const user = await client.query('SELECT * FROM registered WHERE email = $1', [email]);

        // check whether user exist or not
        if (user.rows.length === 0) {
          console.log('Invalid Credential 1');
          client.release();
          return sendJson(400, { message: 'Invalid Creadential', title: "Warning", icon: "danger" });
        }

        // check whether the password matches or not (GetOTP expects password in body in your original flow)
        if (!password) {
          client.release();
          console.log('Password missing for GetOTP');
          return sendJson(400, { message: 'Invalid Creadential', title: "Warning", icon: "danger" });
        }

        const validPassword = await bcrypt.compare(password, user.rows[0].password);
        if (!validPassword) {
          console.log('Invalid Credential 2');
          client.release();
          return sendJson(400, { message: 'Invalid Creadential', title: "Warning", icon: "danger" });
        }

        // Apply rate limiter middleware
        try {
          await runMiddleware(req, res, customLimiter);
          if (res.headersSent) {
            // limiter blocked; client already exists — release and return
            if (client) client.release();
            return;
          }
        } catch (err) {
          console.error("Limiter middleware failed:", err);
          if (client) client.release();
          return sendJson(500, { message: 'Rate limiter failure', title: "Error", icon: "danger" });
        }

        const generatedOtp = generateSecureOTP(8);

        // Replace any existing OTP for the email
        await client.query(`DELETE FROM emailotp WHERE email = $1`, [email]);
        await client.query(`INSERT INTO emailotp (email, otp) VALUES ($1, $2)`, [email, generatedOtp]);
        client.release();

        // Send OTP via email (kept original HTML)
        await transporter.sendMail({
          from: process.env.email,
          to: email,
          subject: "🔐 ASSAM-SDR | OTP Verification",
          html: `
            <div style="
              font-family: Arial, sans-serif;
              background: #f5f7fa;
              padding: 20px;
              border-radius: 10px;
              max-width: 500px;
              margin: auto;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            ">
              <h2 style="color: #007bff; text-align:center;">
                ASSAM-SDR - OTP Verification
              </h2>
              <p style="font-size: 16px; color: #333;">
                Dear User,
              </p>
              <p style="font-size: 16px; color: #333;">
                Use the following One Time Password (OTP) to complete your verification process on the 
                <strong>ASSAM-SDR</strong> platform.
              </p>
              <div style="
                background: #007bff;
                color: white;
                font-size: 24px;
                font-weight: bold;
                letter-spacing: 2px;
                text-align: center;
                padding: 12px;
                border-radius: 8px;
                margin: 20px 0;
              ">
                ${generatedOtp}
              </div>
              <p style="font-size: 14px; color: #555;">
                This OTP is valid for 5 minutes. Please do not share it with anyone for security reasons.
              </p>
              <p style="font-size: 14px; color: #555;">
                Regards,<br>
                <strong>Assam State Space Application Centre (ASSAC)</strong><br>
                <em>Department of Science & Technology, Govt. of Assam</em>
              </p>
            </div>
          `
        });

        // NOTE: original code responded with 400 on success for OTP send — preserved for compatibility
        return sendJson(400, { message: 'OTP sent successfully', title: "Sent", icon: "success" });
      } catch (err) {
        console.error('Error in sending OTP via email:', err);
        if (client) client.release();
        return sendJson(400, { message: 'something went wrong, Try again!', title: "Error", icon: "danger" });
      }
    } catch (err) {
      console.error('Unhandled error in GetOTP:', err);
      return sendJson(400, { message: 'something went wrong, Try again!', title: "Error", icon: "danger" });
    }
  };

  // ----- (2) LOGIN (VERIFY OTP + PASSWORD) -----
  const handleLogin = async () => {
    try {
      if (!email || !password || !otp) {
        return sendJson(200, { message: 'All fields are required', title: "Warning", icon: "warning" });
      }

      let client;
      try {
        client = await getDbClient();
        const userRes = await client.query('SELECT * FROM registered WHERE email = $1', [email]);

        if (userRes.rows.length === 0) {
          client.release();
          console.log('Invalid Credential 1');
          return sendJson(400, { message: 'Invalid Creadential', title: "Warning", icon: "danger" });
        }

        const validPassword = await bcrypt.compare(password, userRes.rows[0].password);
        if (!validPassword) {
          client.release();
          console.log('Invalid Credential 2');
          return sendJson(400, { message: 'Invalid Creadential', title: "Warning", icon: "danger" });
        }

        // get otp & time
        const result = await client.query(`SELECT otp, time FROM emailotp WHERE email = $1`, [email]);
        if (!result.rows.length) {
          client.release();
          console.log('No OTP found for email');
          return sendJson(400, { message: 'Invalid Otp', title: "Warning", icon: "danger" });
        }

        const dbotp = result.rows[0].otp;
        const time = result.rows[0].time;
        const storedOtp = dbotp.toString();

        // release DB client once done
        client.release();

        // expiration check
        if (storedOtp != otp) {
          console.log('Invalid Otp');
          return sendJson(400, { message: 'Invalid Otp', title: "Warning", icon: "danger" });
        }

        if (!isWithinLastFiveMinutes(time)) {
          console.log('expired Otp');
          return sendJson(400, { message: 'Otp Expired', title: "Warning", icon: "danger" });
        }

        // issue JWT (kept same claims and expiry)
        const token = jwt.sign(
          { email: userRes.rows[0].email, role: userRes.rows[0].role },
          process.env.secretKey,
          { expiresIn: '240h' }
        );

        res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
        return sendJson(200, { message: 'Login successful', title: "Sent", icon: "success", redirect: "/" });
      } catch (err) {
        if (client) client.release();
        console.error('Error during login flow:', err);
        return sendJson(400, { message: 'Something went wrong, Try again!', title: "Error", icon: "danger" });
      }
    } catch (err) {
      console.error('Unhandled error in login:', err);
      return sendJson(400, { message: 'Something went wrong, Try again!', title: "Error", icon: "danger" });
    }
  };

  // ----- Dispatch -----
  try {
    if (action === "GetOTP") {
      return await handleSendOTP();
    }

    if (action === "login") {
      return await handleLogin();
    }

    return sendJson(400, { message: 'Unknown action', title: "Error", icon: "danger" });
  } catch (err) {
    console.error('Unhandled route error:', err);
    return sendJson(400, { message: 'Server error', title: "Error", icon: "danger" });
  }
});



router.post('/logout', userAuthMiddleware, (req, res) => {
    try {
        // Clear the cookie containing the token
        res.clearCookie('token', { httpOnly: true, secure: process.env.NODE_ENV === 'production' });

        // Send a success response
        const data = { message: 'Logout successful', title: "Logged Out", icon: "success", redirect: '\\' };
        console.log(data)
        return res.json(data);
    } catch (error) {
        console.error(error);
        const data = { message: 'Logout failed', title: "Error", icon: "error" };

        return res.status(500).json(data);
    }

});

router.post('/secret', userAuthMiddleware, (req, res) => {

    res.render("catalogView")

});








// ✅ Refactored — Forgot Password Route (reduced cognitive complexity, same flow)
router.post('/forgot', upload.single('id_proof'), async (req, res) => {
  const action = req.body.submit; // expected: "GetOTP" or "update"

  // ----- Helpers -----
  const getDbClient = async () => {
    const client = await poolUser.connect();
    return client;
  };

  const isWithinLastFiveMinutes = (timeValue) => {
    if (!timeValue) return false;
    const currentTime_ms = Date.now();
    const FIVE_MINUTES_MS = 5 * 60 * 1000;
    const startTime_ms = currentTime_ms - FIVE_MINUTES_MS;
    const timeA_ms = new Date(timeValue).getTime();
    return timeA_ms > startTime_ms && timeA_ms <= currentTime_ms;
  };

  const validatePasswordDetails = (password) => {
    // Reuse your password schema (assumed to exist in scope)
    return schema.validate(password, { details: true });
  };

  const sendJson = (status, payload) => res.status(status).json(payload);

  // ----- (1) GET OTP -----
  const handleGetOTP = async () => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return sendJson(400, { message: 'Invalid Creadential', title: "Warning", icon: "danger" });
      }

      let client;
      try {
        client = await getDbClient();
        const userRes = await client.query('SELECT * FROM registered WHERE email = $1', [email]);

        if (userRes.rows.length === 0) {
          client.release();
          console.log('Invalid Creadential 1');
          return sendJson(400, { message: 'Invalid Creadential', title: "Warning", icon: "danger" });
        }

        const validPassword = await bcrypt.compare(password, userRes.rows[0].password);
        if (!validPassword) {
          client.release();
          console.log('Invalid Creadential 2');
          return sendJson(400, { message: 'Invalid Creadential', title: "Warning", icon: "danger" });
        }

        // Apply rate limiter middleware
        try {
          await runMiddleware(req, res, customLimiter);
          if (res.headersSent) {
            if (client) client.release();
            return;
          }
        } catch (err) {
          console.error("Limiter middleware failed:", err);
          if (client) client.release();
          return sendJson(400, { message: 'something went wrong, Try again!', title: "Error", icon: "danger" });
        }

        // Generate OTP (your original used generateSecureOTP(10))
        const otp = generateSecureOTP(10);

        // Replace any existing OTP for the email
        await client.query(`DELETE FROM emailotp WHERE email = $1`, [email]);
        await client.query(`INSERT INTO emailotp (email, otp) VALUES ($1, $2)`, [email, otp]);
        client.release();

        // Send OTP via email (kept original HTML)
        await transporter.sendMail({
          from: process.env.email,
          to: email,
          subject: "🔐 ASSAM-SDR | OTP Verification",
          html: `
            <div style="
              font-family: Arial, sans-serif;
              background: #f5f7fa;
              padding: 20px;
              border-radius: 10px;
              max-width: 500px;
              margin: auto;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            ">
              <h2 style="color: #007bff; text-align:center;">
                ASSAM-SDR - OTP Verification
              </h2>
              <p style="font-size: 16px; color: #333;">
                Dear User,
              </p>
              <p style="font-size: 16px; color: #333;">
                Use the following One Time Password (OTP) to complete your verification process on the 
                <strong>ASSAM-SDR</strong> platform.
              </p>
              <div style="
                background: #007bff;
                color: white;
                font-size: 24px;
                font-weight: bold;
                letter-spacing: 2px;
                text-align: center;
                padding: 12px;
                border-radius: 8px;
                margin: 20px 0;
              ">
                ${otp}
              </div>
              <p style="font-size: 14px; color: #555;">
                This OTP is valid for 5 minutes. Please do not share it with anyone for security reasons.
              </p>
              <p style="font-size: 14px; color: #555;">
                Regards,<br>
                <strong>Assam State Space Application Centre (ASSAC)</strong><br>
                <em>Department of Science & Technology, Govt. of Assam</em>
              </p>
            </div>
          `
        });

        // Preserved original success status (400) to avoid breaking frontend flow
        return sendJson(400, { message: 'OTP sent successfully', title: "Sent", icon: "success" });
      } catch (err) {
        console.error('Error in sending OTP via email:', err);
        if (client) client.release();
        return sendJson(400, { message: 'something went wrong, Try again!', title: "Error", icon: "danger" });
      }
    } catch (err) {
      console.error('Unhandled GetOTP error:', err);
      return sendJson(400, { message: 'something went wrong, Try again!', title: "Error", icon: "danger" });
    }
  };

  // ----- (2) VERIFY OTP & UPDATE PASSWORD -----
  const handleUpdatePassword = async () => {
    try {
      const { email, otp, password, re_password } = req.body;

      if (!email || !password || !otp) {
        return sendJson(200, { message: 'All fields are required', title: "Warning", icon: "warning" });
      }

      let client;
      try {
        client = await getDbClient();

        // fetch otp record
        const otpResult = await client.query(`SELECT otp, time FROM emailotp WHERE email = $1`, [email]);
        if (!otpResult.rows.length) {
          client.release();
          return sendJson(400, { message: 'Verify OTP first', title: "Alert", icon: "danger" });
        }

        const dbotp = otpResult.rows[0].otp;
        const time = otpResult.rows[0].time;
        const storedOtp = dbotp.toString();
        const clientotp = otp;

        // time check
        if (clientotp != storedOtp) {
          client.release();
          return sendJson(400, { message: 'invalid otp', title: "Alert", icon: "danger" });
        }

        if (!isWithinLastFiveMinutes(time)) {
          client.release();
          return sendJson(400, { message: 'OTP Expired', title: "Alert", icon: "danger" });
        }

        // fetch registered record
        const regresult = await client.query(`SELECT * FROM registered WHERE email = $1`, [email]);
        if (!regresult.rows.length) {
          client.release();
          return sendJson(400, { message: 'Record not found!', title: "Alert", icon: "warning" });
        }

        // password validations (keeps original schema rules)
        if (password !== re_password) {
          client.release();
          return sendJson(400, { message: 'Password Mismatch', title: "Alert", icon: "warning" });
        }

        const pwValidation = validatePasswordDetails(password);
        if (pwValidation.length !== 0) {
          client.release();
          return sendJson(400, {
            message: 'Minimum length 8 || Must have uppercase letters || Must have lowercase letters || Must have at least 2 digits || Should not have spaces || Must have at least one special character',
            title: "Password criteria",
            icon: "warning"
          });
        }

        // hash & update
        const hash_pw = bcrypt.hashSync(password, 10);
        const updateQuery = `UPDATE registered SET password = $1 WHERE email = $2;`;
        await client.query(updateQuery, [hash_pw, email]);

        // if admin/root also update admins table (kept original behavior)
        if (regresult.rows[0].role === 'admin' || regresult.rows[0].role === 'root') {
          const updateAdmins = `UPDATE admins SET password = $1 WHERE email = $2;`;
          await client.query(updateAdmins, [hash_pw, email]);
        }

        client.release();

        // Preserved original response status (400) to avoid breaking frontend flow
        return sendJson(400, { message: 'Password Updated Successfully', title: "Updated", icon: "success", redirect: "/" });
      } catch (err) {
        console.error('Error updating password:', err);
        if (client) client.release();
        return sendJson(400, { message: 'Something Went Wrong! try again', title: "Wrong", icon: "danger" });
      }
    } catch (err) {
      console.error('Unhandled update error:', err);
      return sendJson(400, { message: 'Something Went Wrong! try again', title: "Wrong", icon: "danger" });
    }
  };

  // ----- Dispatch -----
  try {
    if (action === "GetOTP") {
      return await handleGetOTP();
    }

    if (action === "update") {
      return await handleUpdatePassword();
    }

    return sendJson(400, { message: 'Unknown action', title: "Error", icon: "danger" });
  } catch (err) {
    console.error('Unhandled forgot route error:', err);
    return sendJson(400, { message: 'Server error', title: "Error", icon: "danger" });
  }
});




router.get('*', (req, res) => {
    res.render("404")

});



// ✅ Export the router
export default router;