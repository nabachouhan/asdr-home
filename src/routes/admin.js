// adminRoutes.js (ES6 Module Version)

// ✅ Import modules using ES6 `import`
import express from "express";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import { poolUser, getPoolByTheme } from "../db/connection.js";
import multer from "multer";
import path from "path";
import adminAuthMiddleware from "../middleware/adminAuth.js";
import jwt from "jsonwebtoken";
import AdmZip from "adm-zip";
import axios from "axios";
import validator from "validator";
import fs from "fs";
import cookieParser from "cookie-parser";
import nodemailer from "nodemailer";
import * as XLSX from "xlsx";
import crypto from "crypto";
import { fileURLToPath } from "url";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { spawn } from "child_process";
import bcrypt from 'bcryptjs';
import { escapeHtml, isValidIdentifier, isValidSrid } from "../utils/sanitize.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Call dotenv.config() to load .env variables
dotenv.config();

// ✅ Create an Express Router
const router = express.Router();

// ✅ Middleware setup
router.use(cookieParser());
router.use(bodyParser.json());
router.use(bodyParser.urlencoded({ extended: true }));

// ✅ Email transport configuration using environment variables
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // STARTTLS
  requireTLS: true, // Optional but recommended
  auth: {
    user: process.env.email,
    pass: process.env.appw,
  },
});

// ✅ Middleware runner helper at the top of your file
function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

// ✅ Create the rate limiter, but DO NOT use as middleware
const customLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3,
  handler: (req, res) => {
    // This will be called if limit is exceeded
    return res.status(429).json({
      status: 429,
      error: "Too many requests. Try again in 5 minutes.",
      message: "Too many requests. Try again in 5 minutes.",
      icon: "warning",
    });
  },
  keyGenerator: ipKeyGenerator, // ✅ Safe for IPv4 + IPv6
});

// ✅ Generate OTP (random 8-digit number, CHAR)
function generateSecureOTP(length) {
  const charset =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789";
  let otp = "";
  const randomBytes = crypto.randomBytes(length);

  for (let i = 0; i < length; i++) {
    otp += charset[randomBytes[i] % charset.length];
  }

  return otp;
}

// ------------------------------------------------------------
// ✅ 1. Multer (memory storage) for simple form parsing
//    Used for routes that only need text fields (no file saving).
const upload = multer(); // no storage = memory storage, good for text-only form parsing
// -------------------------------------------------------------
// ✅ Multer setup for login
const loginstorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "logins/"),
  filename: (req, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname)),
});
const login = multer({ storage: loginstorage });

// ------------------------------------------------------------
// ✅ Multer setup for Shapefile uploads
//    Stores shapefile ZIP uploads in the "shpuploads/" directory.
const storage = multer.diskStorage({
  destination: "shpuploads/",
  filename: (req, file, cb) => {
    // 🔐 Use random UUID + original extension to prevent path traversal
    const safeExt = path.extname(file.originalname).toLowerCase();
    cb(null, crypto.randomUUID() + safeExt);
  },
});

// ✅ Multer setup for shape file uploads

const shpupload = multer({
  storage,
  dest: "shpuploads/",
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === "application/zip" ||
      file.mimetype === "application/x-zip-compressed"
    ) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only ZIP files are allowed."));
    }
  },
});
// ----------------------------------------------------------

// ✅ Route: GET / (Login Page)
router.get("/", (req, res) => {
  try {
    res.status(200).render("adminLogin");
  } catch (error) {
    res.status(400).send(error);
  }
});

// ✅ Get all unique tags
router.get("/tags", async (req, res) => {
  try {
    const result = await poolUser.query("SELECT DISTINCT tag FROM catalog");
    const tags = result.rows.map((row) => row.tag);

    res.json(tags);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ✅ Route: GET /admin/  login page (Dashboard, protected by adminAuth)
// -------------------------------
// Helpers
// -------------------------------


// Returns admin record from database using email

async function getAdminByEmail(email) {
  const client = await poolUser.connect();
  try {
    const result = await client.query(
      "SELECT * FROM admins WHERE email = $1",
      [email]
    );
    return { client, admin: result.rows[0] || null };
  } catch (err) {
    client.release();
    throw err;
  }
}

// Validates admin email + password credentials.
// Returns {ok: true, client, admin} when valid.
//  Otherwise returns {ok: false, errorBody}.
async function validateAdminCredentials(email, password) {
  const { client, admin } = await getAdminByEmail(email);

  if (!admin) {
    client.release();
    return {
      ok: false, client, errorBody: {
        message: "Invalid Creadential",
        title: "Warning",
        icon: "danger",
      }
    };
  }

  const validPassword = await bcrypt.compare(password, admin.password);
  if (!validPassword) {
    client.release();
    return {
      ok: false, client, errorBody: {
        message: "Invalid Creadential",
        title: "Warning",
        icon: "danger",
      }
    };
  }

  return { ok: true, client, admin };
}

//  Generates a secure OTP and stores it in database.
//  Deletes any old OTP entry for that email.

async function generateAndStoreOtp(client, email) {
  const otp = generateSecureOTP(8);

  await client.query("DELETE FROM emailotp WHERE email = $1", [email]);
  await client.query(
    "INSERT INTO emailotp (email, otp) VALUES ($1, $2)",
    [email, otp]
  );

  return otp;
}

//  Sends OTP email using nodemailer transporter.

async function sendOtpEmail(to, otp) {
  await transporter.sendMail({
    from: process.env.email,
    to,
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
    `,
  });
}

//  * Handles OTP generation flow.
//  * - Validates credentials
//  * - Applies rate limiter
//  * - Generates & stores OTP

async function handleGetOtp(req, res, email, password) {
  if (!email || !password) {
    return res.status(400).json({
      message: "All fields are required",
      title: "Warning",
      icon: "warning",
    });
  }

  try {
    const { ok, client, errorBody } = await validateAdminCredentials(email, password);

    if (!ok) {
      return res.status(400).json(errorBody);
    }

    // Apply limiter before proceeding
    try {
      await runMiddleware(req, res, customLimiter);
      if (res.headersSent) {
        client.release();
        return;
      }
    } catch (err) {
      client.release();
      console.error("Limiter middleware failed:", err);
      return;
    }

    const otp = await generateAndStoreOtp(client, email);
    client.release();

    await sendOtpEmail(email, otp);

    return res.status(200).json({
      message: "OTP sent successfully",
      title: "Sent",
      icon: "success",
    });
  } catch (err) {
    console.error("Error in sending OTP via email:", err);
    return res.status(500).json({
      message: "something went wrong, Try again!",
      title: "Error",
      icon: "danger",
    });
  }
}

//  * Checks whether an OTP timestamp is still valid

function isOtpWithinLastFiveMinutes(time) {
  const currentTimeMs = Date.now();
  const FIVE_MINUTES_MS = 5 * 60 * 1000;
  const startTimeMs = currentTimeMs - FIVE_MINUTES_MS;
  const timeMs = new Date(time).getTime();

  return timeMs > startTimeMs && timeMs <= currentTimeMs;
}

// Handles login:* - Validate credentials* - Compare OTP* - Check expiration* - Generate JWT cookie

async function handleLogin(req, res, { email, password, otp }) {
  if (!email || !password || !otp) {
    return res.status(400).json({
      message: "All fields are required",
      title: "Warning",
      icon: "warning",
    });
  }

  const { ok, client, admin, errorBody } = await validateAdminCredentials(email, password);

  if (!ok) {
    return res.status(400).json(errorBody);
  }

  const result = await client.query(
    "SELECT otp, time FROM emailotp WHERE email = $1",
    [email]
  );
  client.release();

  if (!result.rows.length) {
    return res.status(400).json({
      message: "Invalid Otp",
      title: "Warning",
      icon: "danger",
    });
  }

  const dbOtp = result.rows[0].otp.toString();
  const time = result.rows[0].time;

  if (dbOtp !== otp) {
    return res.status(400).json({
      message: "Invalid Otp",
      title: "Warning",
      icon: "danger",
    });
  }

  if (!isOtpWithinLastFiveMinutes(time)) {
    return res.status(400).json({
      message: "OTP Expired",
      title: "Warning",
      icon: "danger",
    });
  }

  const jwtToken = jwt.sign(
    {
      email: admin.email,
      full_name: admin.full_name,
      organization: admin.organization,
      designation: admin.designation,
      admin_role: admin.admin_role,
    },
    process.env.adminSecretKey,
    { expiresIn: "8h" }
  );

  res.cookie("token", jwtToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Strict",
  });

  return res.status(201).json({
    message: "Login successful",
    title: "Success",
    icon: "success",
    redirect: "/admin/home",
  });
}

// ✅ Route: POST /admin/ (login + OTP)
router.post("/", login.none(), async (req, res) => {
  const {
    email,
    password,
    otp,
    submit,
  } = req.body;

  try {
    // 2. Branch by submit type
    switch (submit) {
      case "GetOTP":
        return await handleGetOtp(req, res, email, password);
      case "login":
        return await handleLogin(req, res, { email, password, otp });
      default:
        return res.status(400).json({
          message: "Invalid action",
          title: "Error",
          icon: "danger",
        });
    }
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      message: "Something went wrong",
      title: "Error",
      icon: "danger",
    });
  }
});


// ✅ Route: GET /home (Dashboard, protected by adminAuth)
router.get("/home", adminAuthMiddleware, async (req, res) => {
  try {
    const client = await poolUser.connect();

    const result = await client.query("SELECT Count(email) FROM registered");
    const allregistered = await client.query(
      "SELECT Count(email) FROM registered"
    );
    const viewer = await client.query(
      `SELECT Count(email) FROM registered WHERE role='viewer'`
    );
    const datareader = await client.query(
      `SELECT Count(email) FROM registered WHERE role='datareader'`
    );
    const admin = await client.query(
      `SELECT Count(email) FROM registered WHERE role='admin'`
    );
    const root = await client.query(
      `SELECT Count(email) FROM registered WHERE role='root'`
    );

    const allrequests = await client.query(`SELECT Count(email) FROM requests`);
    const panding = await client.query(
      `SELECT Count(email) FROM requests WHERE request_status='panding'`
    );
    const approved = await client.query(
      `SELECT Count(email) FROM requests WHERE request_status='approved'`
    );
    const rejected = await client.query(
      `SELECT Count(email) FROM requests WHERE request_status='rejected'`
    );
    const isolated = await client.query(
      `SELECT Count(email) FROM requests WHERE request_status='isolated'`
    );

    const allqueries = await client.query(`SELECT Count(queryid) FROM queries`);
    const queriesnew = await client.query(
      `SELECT Count(queryid) FROM queries WHERE isresolved=${false}`
    );
    const queriesreloved = await client.query(
      `SELECT Count(queryid) FROM queries WHERE isresolved=${true}`
    );

    const catalogall = await client.query(
      `SELECT Count(file_name) FROM catalog`
    );
    const administrative = await client.query(
      `SELECT Count(file_name) FROM catalog WHERE theme='administrative'`
    );
    const weatherclimate = await client.query(
      `SELECT Count(file_name) FROM catalog WHERE theme='weatherclimate'`
    );
    const landresource = await client.query(
      `SELECT Count(file_name) FROM catalog WHERE theme='landresource'`
    );
    const waterresource = await client.query(
      `SELECT Count(file_name) FROM catalog WHERE theme='waterresource'`
    );
    const disastermanagement = await client.query(
      `SELECT Count(file_name) FROM catalog WHERE theme='disastermanagement'`
    );
    const infrastructure = await client.query(
      `SELECT Count(file_name) FROM catalog WHERE theme='infrastructure'`
    );
    const utility = await client.query(
      `SELECT Count(file_name) FROM catalog WHERE theme='utility'`
    );

    client.release();

    // Add more stats to first result row
    result.rows[0].allregistered = allregistered.rows[0].count;
    result.rows[0].viewer = viewer.rows[0].count;
    result.rows[0].datareader = datareader.rows[0].count;
    result.rows[0].admin = admin.rows[0].count;
    result.rows[0].root = root.rows[0].count;

    result.rows[0].allrequests = allrequests.rows[0].count;
    result.rows[0].panding = panding.rows[0].count;
    result.rows[0].approved = approved.rows[0].count;
    result.rows[0].rejected = rejected.rows[0].count;
    result.rows[0].isolated = isolated.rows[0].count;

    result.rows[0].allqueries = allqueries.rows[0].count;
    result.rows[0].queriesnew = queriesnew.rows[0].count;
    result.rows[0].queriesreloved = queriesreloved.rows[0].count;

    result.rows[0].catalogall = catalogall.rows[0].count;
    result.rows[0].administrative = administrative.rows[0].count;
    result.rows[0].weatherclimate = weatherclimate.rows[0].count;
    result.rows[0].landresource = landresource.rows[0].count;
    result.rows[0].waterresource = waterresource.rows[0].count;
    result.rows[0].disastermanagement = disastermanagement.rows[0].count;
    result.rows[0].infrastructure = infrastructure.rows[0].count;
    result.rows[0].utility = utility.rows[0].count;

    result.rows[0].admin_id = req.user.admin_id;
    result.rows[0].full_name = req.user.full_name;

    const userItems = result.rows[0];

    res.status(200).render("adminHome", { userItems });
  } catch (error) {
    const data = { message: error.message, title: "Oops?", icon: "danger" };
    return res.status(400).send(data);
  }
});

// ✅ Route: GET /Requests client request history (Dashboard, protected by adminAuth)
router.get("/requests", adminAuthMiddleware, async (req, res) => {
  try {
    const client = await poolUser.connect();

    const page = Number.parseInt(req.query.page) || 1;
    const limit = 10;
    const offset = (page - 1) * limit;
    const sortField = req.query.sortField || "id";
    const sortOrder = req.query.sortOrder || "ASC";
    const searchField = req.query.searchField || "";
    const searchValue = req.query.searchValue || "";
    const status = req.query.status || "all";

    // console.log('Request Query:', { page, sortField, sortOrder, searchField, searchValue, status });

    const validSortFields = [
      "id",
      "first_name",
      "email",
      "organization",
      "designation",
      "file_name",
      "created_at",
      "fields",
      "values",
      "query_condition",
      "request_status",
    ];
    const safeSortField = validSortFields.includes(sortField)
      ? sortField
      : "id";
    const safeSortOrder = sortOrder.toUpperCase() === "DESC" ? "DESC" : "ASC";

    // Base queries
    let query = `
      SELECT r.id, r.email, r.file_name, r.fields, r.values, r.created_at, r.query_condition, r.request_status,
             u.first_name, u.last_name, u.organization, u.designation, u.id_proof 
      FROM requests r 
      LEFT JOIN registered u ON r.email = u.email 
      WHERE 1=1
    `;
    let countQuery = `
      SELECT COUNT(*) 
      FROM requests r 
      LEFT JOIN registered u ON r.email = u.email 
      WHERE 1=1
    `;
    let queryParams = [];
    let countParams = [];

    // Add status filter
    if (status !== "all") {
      query += ` AND r.request_status = $${queryParams.length + 1}`;
      countQuery += ` AND r.request_status = $${countParams.length + 1}`;
      queryParams.push(status);
      countParams.push(status);
    }

    // Add search condition
    if (searchField && searchValue) {
      const validSearchFields = [
        "id",
        "first_name",
        "email",
        "organization",
        "designation",
        "file_name",
        "fields",
        "values",
        "query_condition",
        "request_status",
      ];
      if (validSearchFields.includes(searchField)) {
        queryParams.push(`%${searchValue}%`);
        countParams.push(`%${searchValue}%`);
        const paramIndex = queryParams.length;
        if (
          ["first_name", "organization", "designation"].includes(searchField)
        ) {
          query += ` AND u.${searchField} ILIKE $${paramIndex}`;
          countQuery += ` AND u.${searchField} ILIKE $${paramIndex}`;
        } else {
          query += ` AND r.${searchField} ILIKE $${paramIndex}`;
          countQuery += ` AND r.${searchField} ILIKE $${paramIndex}`;
        }
      }
    }

    // Sorting
    if (["first_name", "organization", "designation"].includes(safeSortField)) {
      query += ` ORDER BY u.${safeSortField} ${safeSortOrder}`;
    } else {
      query += ` ORDER BY r.${safeSortField} ${safeSortOrder}`;
    }

    // Pagination
    queryParams.push(limit, offset);
    query += ` LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`;

    console.log("SQL Query:", query);
    console.log("Query Params:", queryParams);

    // Execute
    const reqResult = await client.query(query, queryParams);
    const combinedData = reqResult.rows.map((item) => ({
      id: item.id,
      first_name: item.first_name || "",
      last_name: item.last_name || "",
      email: item.email,
      organization: item.organization || "",
      designation: item.designation || "",
      file_name: item.file_name,
      fields: item.fields || "",
      values: item.values || "",
      query_condition: item.query_condition || "",
      created_at: item.created_at.toLocaleString(),
      id_proof: item.id_proof ? item.id_proof.toString("base64") : null,
      request_status: item.request_status || "pending",
    }));

    const countResult = await client.query(countQuery, countParams);
    const totalItems = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalItems / limit);

    console.log(
      "Fetched Rows:",
      combinedData.length,
      "Total Items:",
      totalItems
    );

    client.release();

    res.status(200).render("adminFileRequests", {
      combinedData,
      currentPage: page,
      totalPages,
      sortField: safeSortField,
      sortOrder: safeSortOrder,
      searchField: searchField || "",
      searchValue: searchValue || "",
      status: status || "all",
      admin_id: req.user.admin_id,
      full_name: req.user.full_name,
    });
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).send("Internal Server Error");
  }
});

// ✅ Route: POST /handlerequests Handle client request  approve , reject, isolate (Dashboard, protected by adminAuth)
router.post("/handlerequests", adminAuthMiddleware, async (req, res) => {
  const { id, action, file_name } = req.body;

  const admin_fullname = req.user.full_name;
  const admin_email = req.user.email;
  const admin_organization = req.user.organization;

  try {
    const client = await poolUser.connect();

    let update_query = "";
    let params = [];

    if (action === "approved") {
      console.log(action);

      update_query = `
                UPDATE requests
                SET request_status=$1
                WHERE id=$2
            `;
      params = [action, id];
      const sr = await client.query(update_query, params);
      console.log(update_query, params, sr);
    } else if (action === "rejected") {
      console.log(action);

      update_query = `
            UPDATE requests
            SET request_status=$1
            WHERE id=$2
        `;
      params = [action, id];
      await client.query(update_query, params);
      console.log(update_query, params);
    } else if (action === "isolated") {
      console.log(action);

      update_query = `
                UPDATE requests
                SET request_status=$1
                WHERE id=$2
            `;
      params = [action, id];
      await client.query(update_query, params);
      console.log(update_query, params);
    }

    const actiononfo = `${action} request no: ${id}`;
    const logsquery = `INSERT INTO adminlogs (email, organization, full_name, action_type, target, details)
        VALUES ($1, $2, $3, $4, $5, $6) `;
    const logsparams = [
      admin_email,
      admin_organization,
      admin_fullname,
      action,
      file_name,
      actiononfo,
    ];
    console.log(logsparams);

    await client.query(logsquery, logsparams);
    client.release();

    const data = {
      message: `Request ${action}d`,
      title: "Success",
      icon: "success",
    };
    return res.status(200).json(data);
  } catch (error) {
    console.error("Error handling request:", error);
    const data = {
      message: "An error occurred",
      title: "Error",
      icon: "error",
    };
    return res.status(500).json(data);
  }
});


// ✅ Route: GET /adminLogs View and Download logs different role based users  (Dashboard, protected by adminAuth)
router.get("/adminLogs", adminAuthMiddleware, (req, res) => {
  try {
    res.status(200).render("adminLogs");
  } catch (error) {
    const data = { message: error, title: "Oops?", icon: "danger" };
    return res.status(400).json(data);
  }
});

// ✅ Route: GET /upload Get upload  Shapefiles/metadata Form  (Dashboard, protected by adminAuth)
router.get("/upload", adminAuthMiddleware, async (req, res) => {
  try {
    const client = await poolUser.connect();
    const { rows } = await client.query(
      "SELECT  file_name FROM catalog WHERE edit_mode=true"
    );
    client.release();
    res
      .status(200)
      .render("adminUpload", {
        catalogItems: rows,
        admin_id: req.user.admin_id,
        full_name: req.user.full_name,
      });
  } catch (error) {
    const data = { message: error, title: "Oops?", icon: "danger" };
    return res.status(400).json(data);
  }
});

// ✅ Route: POST /shpuploads Upload Shapefiles To database  (Dashboard, protected by adminAuth)
router.post(
  "/shpuploads",
  adminAuthMiddleware,
  shpupload.single("uploaded_file"),
  async (req, res) => {
    console.log(req.body);

    // Function to clean up files
    const cleanupFiles = () => {
      try {
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
          console.log(`Deleted uploaded file: ${req.file.path}`);
        }
        const fullDirectoryPath = path.join("shpuploads/", req.body.file_name);
        if (fs.existsSync(fullDirectoryPath)) {
          fs.rmSync(fullDirectoryPath, { recursive: true, force: true });
          console.log(`Deleted extracted directory: ${fullDirectoryPath}`);
        }
      } catch (cleanupError) {
        console.error(`Cleanup error: ${cleanupError}`);
      }
    };

    try {
      const { file_type, theme, file_name, srid } = req.body;
      const admin_fullname = req.user.full_name;
      const admin_email = req.user.email;
      const admin_organization = req.user.organization;

      // Validate required fields
      if (!file_name || !file_type || !theme || !srid) {
        cleanupFiles();
        const data = {
          message: "All fields are required",
          title: "Alert",
          icon: "warning",
          redirect: "\\admin\\upload",
        };
        return res.status(400).json(data);
      }

      // 🔐 Validate SRID (must be numeric only — prevents command injection)
      if (!isValidSrid(srid)) {
        cleanupFiles();
        return res.status(400).json({
          message: "Invalid SRID value. Must be numeric.",
          title: "Error",
          icon: "error",
          redirect: "\\admin\\upload",
        });
      }

      // 🔐 Validate file_name (only letters, numbers, underscores — prevents command/SQL injection)
      if (!isValidIdentifier(file_name)) {
        cleanupFiles();
        return res.status(400).json({
          message: "Invalid file name. Only letters, numbers, and underscores are allowed.",
          title: "Error",
          icon: "error",
          redirect: "\\admin\\upload",
        });
      }

      // 🔐 Validate theme against whitelist
      const validThemes = ['administrative', 'weatherclimate', 'landresource', 'waterresource', 'disastermanagement', 'infrastructure', 'utility', 'terrain'];
      if (!validThemes.includes(theme)) {
        cleanupFiles();
        return res.status(400).json({
          message: "Invalid theme selected.",
          title: "Error",
          icon: "error",
          redirect: "\\admin\\upload",
        });
      }

      // Check if file_name already exists in the database
      const client = await poolUser.connect();
      const query = `
            SELECT file_name 
            FROM catalog 
            WHERE file_name = $1
        `;
      const result = await client.query(query, [file_name]);
      const checkTableExists = result.rows.length > 0;
      client.release();

      if (checkTableExists) {
        cleanupFiles();
        const data = {
          message: "Shapefile name already exists",
          title: "Oops?",
          icon: "danger",
          redirect: "\\admin\\upload",
        };
        return res.status(400).json(data);
      }

      // Validate that the uploaded file is a zip
      if (
        !req.file ||
        path.extname(req.file.originalname).toLowerCase() !== ".zip"
      ) {
        cleanupFiles();
        const data = {
          message: "Uploaded file must be a zip archive",
          title: "Error",
          icon: "error",
          redirect: "\\admin\\upload",
        };
        return res.status(400).json(data);
      }

      // Extract the zip file
      const basedir = "shpuploads/";
      const zip = new AdmZip(req.file.path);
      const fullDirectoryPath = path.join(basedir, file_name);

      try {
        zip.extractAllTo(fullDirectoryPath, true);
      } catch (zipError) {
        console.error(`Zip extraction error: ${zipError}`);
        cleanupFiles();
        const data = {
          message: "Invalid zip archive",
          title: "Error",
          icon: "error",
          redirect: "\\admin\\upload",
        };
        return res.status(400).json(data);
      }

      // Validate shapefile components (.shp, .shx, .dbf are required)
      const tmpshppath0 = path.join(
        fullDirectoryPath,
        req.file.originalname.replace(".zip", ".shp")
      );
      const tmpshppath = path.normalize(tmpshppath0);
      const shapefilePath = tmpshppath.replace(".zip", ".shp");
      const shxPath = shapefilePath.replace(".shp", ".shx");
      const dbfPath = shapefilePath.replace(".shp", ".dbf");

      if (
        !fs.existsSync(shapefilePath) ||
        !fs.existsSync(shxPath) ||
        !fs.existsSync(dbfPath)
      ) {
        cleanupFiles();
        const data = {
          message:
            "Uploaded zip does not contain a valid shapefile (.shp, .shx, .dbf required)",
          title: "Error",
          icon: "error",
          redirect: "\\admin\\upload",
        };
        return res.status(400).json(data);
      }

      // 🔐 Execute shp2pgsql | psql command — srid, file_name, theme are validated above
      const cmd = `shp2pgsql -I -s ${srid} ${shapefilePath} ${file_name} | psql -U ${process.env.db_user} -d ${theme}`;
      console.log(cmd);

      const child = spawn(cmd, [], {
        env: { ...process.env, PGPASSWORD: process.env.PGPASSWORD },
        shell: true,
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      child.on("error", (error) => {
        console.error(`spawn error: ${error}`);
        cleanupFiles();
        const data = {
          message: `Failed to process shapefile: ${error.message}`,
          title: "Error",
          icon: "error",
          redirect: "\\admin\\upload",
        };
        return res.status(400).json(data);
      });

      child.on("close", async (code) => {
        if (code !== 0) {
          console.error(`stderr: ${stderr}`);
          cleanupFiles();
          const errorMessage = stderr
            ? `Database upload failed: ${stderr}`
            : "Database upload failed";
          const data = {
            message: errorMessage,
            title: "Error",
            icon: "error",
            redirect: "\\admin\\upload",
          };
          return res.status(400).json(data);
        }

        // File copying to catalog
        const catalogPath = path.join(__dirname, "../../catalog");
        let sourceFilePath = req.file.path;

        if (!fs.existsSync(sourceFilePath)) {
          cleanupFiles();
          const data = {
            message: "Source file not found after upload",
            title: "Error",
            icon: "error",
            redirect: "\\admin\\upload",
          };
          return res.status(404).json(data);
        }

        if (!fs.existsSync(catalogPath)) {
          fs.mkdirSync(catalogPath, { recursive: true });
        }

        const fileExtension = path.extname(sourceFilePath);
        const destinationFilePath = path.join(
          catalogPath,
          `${file_name}${fileExtension}`
        );
        console.log(fileExtension);
        console.log(destinationFilePath);

        try {
          fs.copyFileSync(sourceFilePath, destinationFilePath);
        } catch (copyError) {
          console.error(`File copy error: ${copyError}`);
          cleanupFiles();
          const data = {
            message: "Failed to copy file to catalog",
            title: "Error",
            icon: "error",
            redirect: "\\admin\\upload",
          };
          return res.status(400).json(data);
        }

        // Insert into catalog and adminlogs
        const visibility = false;
        const is_published = false;
        const catalogQuery = `
                INSERT INTO catalog (file_name, file_type, theme, srid, visibility, is_published)
                VALUES ($1, $2, $3, $4, $5, $6)
            `;
        const catalogValues = [
          file_name,
          file_type,
          theme,
          srid,
          visibility,
          is_published,
        ];

        const logQuery = `
                INSERT INTO adminlogs(email, organization, full_name, action_type, target, details) 
                VALUES ($1, $2, $3, $4, $5, $6)
            `;
        const action_type = "upload file";
        const details = `Uploaded file ${file_name} to DB`;
        const logValues = [
          admin_email,
          admin_organization,
          admin_fullname,
          action_type,
          file_name,
          details,
        ];

        try {
          const client = await poolUser.connect();
          await client.query(catalogQuery, catalogValues);
          await client.query(logQuery, logValues);
          client.release();
          console.log("Shapefile uploaded successfully");
          cleanupFiles(); // Clean up files after successful upload
          const data = {
            message: "Shapefile uploaded successfully",
            title: "Uploaded",
            icon: "success",
            redirect: "\\admin\\upload",
          };
          return res.status(201).json(data);
        } catch (dbError) {
          console.error("Database error:", dbError);
          cleanupFiles();
          const data = {
            message: `Database error: ${dbError.message}`,
            title: "Error",
            icon: "error",
            redirect: "\\admin\\upload",
          };
          return res.status(400).json(data);
        }
      });
    } catch (error) {
      console.error(`Error: ${error}`);
      cleanupFiles();
      const data = {
        message: `Invalid zip format or processing error: ${error.message}`,
        title: "Error",
        icon: "error",
        redirect: "\\admin\\upload",
      };
      return res.status(400).json(data);
    }
  }
);


// ✅ Route: GET /catalog/:file_name to fetch item details based on file_name of Repository  (Dashboard, protected by adminAuth)
router.get("/catalog/:file_name", adminAuthMiddleware, async (req, res) => {
  try {
    const { file_name } = req.params;

    const uclient = await poolUser.connect();
    const result = await uclient.query(
      `SELECT * FROM catalog WHERE file_name = $1`,
      [file_name]
    );
    console.log(result.rows[0]);

    const title = result.rows[0].title;
    const file_type = result.rows[0].file_type;
    const theme = result.rows[0].theme;

    const publisher = result.rows[0].publisher;
    const language = result.rows[0].language;
    const public_access_level = result.rows[0].public_access_level;
    const citation = result.rows[0].citation;
    const source_date = result.rows[0].source_date;
    const group_visibility = result.rows[0].group_visibility;
    const data_abstract = result.rows[0].data_abstract;
    const metadata_date = result.rows[0].metadata_date;
    const area_of_interest = result.rows[0].area_of_interest;

    const data_quality = result.rows[0].data_quality;
    const projection = result.rows[0].projection;
    const scale = result.rows[0].scale;
    const district = result.rows[0].district;
    const tag = result.rows[0].tag;
    const department = result.rows[0].department;

    console.log("const theme = themerow[0]");

    uclient.release();
    let client;

    // 🔐 Validate file_name as safe SQL identifier
    if (!isValidIdentifier(file_name)) {
      return res.status(400).json({ error: "Invalid file name" });
    }

    const pool = getPoolByTheme(theme);
    client = await pool.connect();
    const { rows } = await client.query(
      `SELECT ST_AsText(ST_Envelope(ST_Extent(geom))) AS bbox_geom_wkt
            FROM "${file_name}";`
    );

    function roundWKT(wkt, decimals = 3) {
      return wkt.replace(/([-+]?\d*\.\d+|\d+)/g, (num) => {
        return parseFloat(num).toFixed(decimals);
      });
    }

    const roundedWKT = roundWKT(rows[0].bbox_geom_wkt, 3);

    client.release();

    // console.log(roundedWKT);

    if (rows.length) {
      res.json({
        bbox: roundedWKT,
        title: title,
        theme: theme,
        file_type: file_type,
        publisher: publisher,
        language: language,
        public_access_level: public_access_level,
        citation: citation,
        source_date: source_date,
        group_visibility: group_visibility,
        data_abstract: data_abstract,
        metadata_date: metadata_date,
        area_of_interest: area_of_interest,
        data_quality: data_quality,
        projection: projection,
        scale: scale,
        district: district,
        tag: tag,
        department: department,
      });
    } else {
      res.status(404).send("File not found");
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// ✅ Route: POST /metadata Upload Metadata To database  (Dashboard, protected by adminAuth)
router.post(
  "/metadata",
  adminAuthMiddleware,
  upload.none(),
  async (req, res) => {

    const admin_fullname = req.user.full_name;
    const admin_email = req.user.email;
    const admin_organization = req.user.organization;

    // return

    const {
      meta_file_name,
      title,
      spatial_coverage,
      publisher,
      public_access_level,
      citation,
      source_date,
      group_visibility,
      data_abstract,
      area_of_interest,
      metadata_date,
      data_quality,
      language,
      projection,
      scale,
      district,
      tag,
      department,
    } = req.body;

    try {
      const client = await poolUser.connect();
      // const result = await uclient.query()
      // const theme = result.rows[0].theme

      await client.query(
        `
        UPDATE catalog SET
          title = $1,
          spatial_coverage = $2,
          publisher = $3,
          public_access_level = $4,
          citation = $5,
          source_date = $6,
          group_visibility = $7,
          data_abstract = $8,
          area_of_interest = $9,
          metadata_date = $10,
          data_quality = $11,
          language = $12,
          projection = $13,
          scale = $14,
          edit_mode = $15,
          district = $16, 
          tag = $17,
          department = $18
        WHERE file_name = $19
      `,
        [
          title,
          spatial_coverage,
          publisher,
          public_access_level,
          citation,
          source_date,
          group_visibility,
          data_abstract,
          area_of_interest,
          metadata_date,
          data_quality,
          language,
          projection,
          scale,
          false,
          district,
          tag,
          department,
          meta_file_name,
        ]
      );

      const queryforlogs = `
            INSERT INTO adminlogs(email, organization, full_name, action_type, target, details) 
            VALUES($1, $2, $3, $4, $5, $6)
            `;

      const action_type = " Update Metadata";
      const details = `Updated Metadata`;
      const valuesforlogs = [
        admin_email,
        admin_organization,
        admin_fullname,
        action_type,
        meta_file_name,
        details,
      ];
      client.query(queryforlogs, valuesforlogs);

      client.release();

      const data = {
        message: "Meta data updated successfuly",
        title: "Updated",
        icon: "success",
        redirect: "\\admin\\upload",
      };
      return res.json(data);

      //   res.redirect('/success'); // or send a JSON response
    } catch (err) {
      console.error("Error updating metadata:", err);
      const data = {
        message: "Error updating metadata",
        title: "Ooops",
        icon: "danger",
      };
      return res.status(500).json(data);
    }
  }
);

// ✅ Route: GET /metadata to get Publish page to publish on geoserver  (Dashboard, protected by adminAuth)
router.get("/publish", adminAuthMiddleware, async (req, res) => {
  try {
    const client = await poolUser.connect();
    const { rows } = await client.query(
      "SELECT  file_name,title,theme FROM catalog WHERE is_published=false"
    );
    client.release();
    console.log(rows);
    res.status(200).render("adminPublish", {
      catalogItems: rows,
      admin_id: req.user.admin_id,
      full_name: req.user.full_name,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// ✅ Route: POST /catalog to  Publish  on geoserver using Geoserver Restapi  (Dashboard, protected by adminAuth)
router.post(
  "/catalog",
  upload.none(),
  adminAuthMiddleware,
  async (req, res) => {
    console.log(req.body);
    const { file_name, workspace, theme, title } = req.body;

    const admin_fullname = req.user.full_name;
    const admin_email = req.user.email;
    const admin_organization = req.user.organization;

    const DEFAULT_SRS = "EPSG:4326";
    const RESPONSE_STATUSES = {
      SUCCESS: "success",
      ERROR: "error",
      WARNING: "warning",
    };
    const store = theme;
    try {
      // GeoServer configuration
      const geoserverClient = axios.create({
        baseURL:
          process.env.GEOSERVER_URL || "http://localhost:8080/geoserver/rest",
        auth: {
          username: process.env.GEOSERVER_USERNAME || "admin",
          password: process.env.GEOSERVER_PASSWORD || "geoserver",
        },
        timeout: 5000,
      });

      // Check if workspace exists
      // Check workspace
      try {
        await geoserverClient.get(`/workspaces/${workspace}`);
      } catch (error) {
        if (error.response?.status === 404) {
          return res.status(404).json({
            status: RESPONSE_STATUSES.ERROR,
            message: `Workspace "${workspace}" not found.`,
          });
        }
        throw error; // re-throw other errors
      }

      // Check datastore
      try {
        await geoserverClient.get(
          `/workspaces/${workspace}/datastores/${store}`
        );
      } catch (error) {
        if (error.response?.status === 404) {
          return res.status(404).json({
            status: RESPONSE_STATUSES.ERROR,
            message: `Datastore "${store}" not found in workspace "${workspace}".`,
            icon: "warning",
          });
        }
        throw error;
      }

      // Check if feature type exists
      const featureTypesResponse = await geoserverClient.get(
        `/workspaces/${workspace}/datastores/${store}/featuretypes`
      );
      const featureTypes =
        featureTypesResponse.data.featureTypes?.featureType || [];
      const featureTypeExists = featureTypes.some(
        (ft) => ft.name === file_name
      );

      if (featureTypeExists) {
        return res.status(400).json({
          status: RESPONSE_STATUSES.WARNING,
          message: "Layer already exists in the workspace",
          icon: "warning",
        });
      }

      // Create new feature type
      await geoserverClient.post(
        `/workspaces/${workspace}/datastores/${store}/featuretypes`,
        {
          featureType: {
            name: file_name,
            nativeName: file_name,
            title: title,
            srs: DEFAULT_SRS,
          },
        }
      );

      // Update database in a transaction
      const client = await poolUser.connect();
      try {
        await client.query("BEGIN");

        const catalogQuery = `
                UPDATE catalog
                SET visibility = $1, is_published = $2
                WHERE file_name = $3
            `;
        const catalogValues = [true, true, file_name];
        await client.query(catalogQuery, catalogValues);

        const queryforlogs = `
            INSERT INTO adminlogs(email, organization, full_name, action_type, target, details) 
            VALUES($1, $2, $3, $4, $5, $6)
            `;

        const action_type = " Publish";
        const details = `Published data`;
        const valuesforlogs = [
          admin_email,
          admin_organization,
          admin_fullname,
          action_type,
          file_name,
          details,
        ];
        client.query(queryforlogs, valuesforlogs);

        await client.query("COMMIT");
      } catch (dbError) {
        await client.query("ROLLBACK");
        throw dbError;
      } finally {
        client.release();
      }

      return res.status(201).json({
        status: RESPONSE_STATUSES.SUCCESS,
        title: "great",
        message: "File Published to GeoServer",
        icon: "success",
        data: { file_name },
        redirect: "\\admin\\publish",
      });
    } catch (error) {
      console.error("Error publishing layer:", error);
      return res.status(500).json({
        status: RESPONSE_STATUSES.ERROR,
        message: "Failed to publish layer",
        icon: "danger",
      });
    }
  }
);

// ✅ Route: POST /delete to  Delete The Layer from geoserver And Database  (Dashboard, protected by adminAuth)
router.post("/delete", adminAuthMiddleware, async (req, res) => {

  const { file_name, store } = req.body;
  const workspace = "asdr";
  const geoserverUrl = "http://localhost:8080/geoserver/rest";
  const auth = {
    username: process.env.GEOSERVER_USERNAME,
    password: process.env.GEOSERVER_PASSWORD,
  };

  const admin_fullname = req.user.full_name;
  const admin_email = req.user.email;
  const admin_organization = req.user.organization;

  if (!file_name || !store) {
    return res.status(400).json({
      message: "Some required fields are missing",
      title: "warning",
      icon: "warning",
    });
  }

  try {
    const featureTypesResponse = await axios.get(
      `${geoserverUrl}/workspaces/${workspace}/datastores/${store}/featuretypes`,
      { auth }
    );

    const existingFeatureTypes =
      featureTypesResponse.data.featureTypes?.featureType || [];
    const featureTypeExists = existingFeatureTypes.some(
      (ft) => ft.name === file_name
    );

    if (featureTypeExists) {
      await axios.delete(`${geoserverUrl}/layers/${file_name}`, { auth });

      const theme = store;
      // 🔐 Validate file_name before using in dynamic SQL
      if (!isValidIdentifier(file_name)) {
        return res.status(400).json({ message: "Invalid file name", icon: "danger" });
      }
      const pool = getPoolByTheme(theme);
      const client2 = await pool.connect();
      await client2.query(`DROP TABLE IF EXISTS "${file_name}"`);
      client2.release();

      await axios.delete(
        `${geoserverUrl}/workspaces/${workspace}/datastores/${store}/featuretypes/${file_name}?recurse=true`,
        { auth }
      );

      const client = await poolUser.connect();
      await client.query(`DELETE FROM catalog WHERE file_name = $1`, [
        file_name,
      ]);
      client.release();

      return res.status(200).json({
        message: "Layer deleted successfully from both GeoServer & PostgreSQL",
        icon: "success",
        success: true,
      });
    } else {
      const client = await poolUser.connect();
      await client.query(`DELETE FROM catalog WHERE file_name = $1`, [
        file_name,
      ]);

      const queryforlogs = `
            INSERT INTO adminlogs(email, organization, full_name, action_type, target, details) 
            VALUES($1, $2, $3, $4, $5, $6)
            `;

      const action_type = "Delete";
      const details = `${file_name} Deleted Parmanently From Databse and Geoserver`;
      const valuesforlogs = [
        admin_email,
        admin_organization,
        admin_fullname,
        action_type,
        file_name,
        details,
      ];
      client.query(queryforlogs, valuesforlogs);

      client.release();

      return res.status(200).json({
        message:
          "Feature type does not exist, but records removed from database",
        title: "warning",
        icon: "warning",
        success: true,
      });
    }
  } catch (error) {
    console.error(`Unexpected error: ${error}`);
    return res.status(500).json({
      message: "Unexpected server error",
      title: "Error",
      icon: "danger",
      success: false,
    });
  }
});

// ✅ Route: GET /logs to  get The Logs page of of different user type  (Dashboard, protected by adminAuth)
router.get("/logs", adminAuthMiddleware, async (req, res) => {
  try {
    const client = await poolUser.connect();

    const page = parseInt(req.query.page) || 1;
    const limit = 10; // Adjust as needed
    const offset = (page - 1) * limit;
    const sortField = req.query.sortField || "sn";
    const sortOrder = req.query.sortOrder || "ASC";
    const searchField = req.query.searchField || "";
    const searchValue = req.query.searchValue || "";
    const role = req.query.role || "viewer";
    const dateFrom = req.query.dateFrom || "";
    const dateTo = req.query.dateTo || "";

    // Validate sortField to prevent SQL injection
    const validSortFields = [
      "sn",
      "full_name",
      "email",
      "organization",
      "action_type",
      "target",
      "details",
      "created_at",
    ];
    const safeSortField = validSortFields.includes(sortField)
      ? sortField
      : "sn";
    const safeSortOrder = sortOrder.toUpperCase() === "DESC" ? "DESC" : "ASC";

    // Validate role
    const validRoles = ["viewer", "datareader", "admin"];
    const safeRole = validRoles.includes(role) ? role : "viewer";

    // Determine table based on role
    const tableMap = {
      viewer: "viewerlogs",
      datareader: "datareaderlogs",
      admin: "adminlogs",
    };
    const table = tableMap[safeRole];
    // Build query
    let query = `SELECT sn, full_name, organization, email, action_type, target, details, created_at FROM ${table}`;
    let countQuery = `SELECT COUNT(sn) FROM ${table}`;
    let queryParams = [];
    let countParams = [];

    // Add search and date conditions
    let conditions = [];
    if (searchField && searchValue) {
      const validSearchFields = [
        "sn",
        "full_name",
        "organization",
        "email",
        "action_type",
        "target",
        "details",
        "created_at",
      ];
      if (validSearchFields.includes(searchField)) {
        queryParams.push(`%${searchValue}%`);
        countParams.push(`%${searchValue}%`);
        conditions.push(`${searchField} ILIKE $${queryParams.length}`);
      }
    }
    if (dateFrom) {
      queryParams.push(dateFrom);
      countParams.push(dateFrom);
      conditions.push(`created_at >= $${queryParams.length}`);
    }
    if (dateTo) {
      queryParams.push(dateTo);
      countParams.push(dateTo);
      conditions.push(`created_at <= $${queryParams.length}`);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
      countQuery += " WHERE " + conditions.join(" AND ");
    }

    // Add sorting
    query += ` ORDER BY ${safeSortField} ${safeSortOrder}`;

    // Add pagination
    queryParams.push(limit, offset);
    query += ` LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`;

    console.log("Query:", query, "Params:", queryParams);
    console.log("Count Query:", countQuery, "Count Params:", countParams);

    // Execute queries
    const result = await client.query(query, queryParams);
    const logs = result.rows;

    const countResult = await client.query(countQuery, countParams);
    const totalItems = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalItems / limit);

    // Initialize log arrays
    let viewerLogs = safeRole === "viewer" ? logs : [];
    let datareaderLogs = safeRole === "datareader" ? logs : [];
    let adminLogs = safeRole === "admin" ? logs : [];

    client.release();

    res.status(200).render("adminLogs", {
      viewerLogs,
      datareaderLogs,
      adminLogs,
      currentPage: page,
      totalPages,
      sortField: safeSortField,
      sortOrder: safeSortOrder,
      searchField: searchField || "",
      searchValue: searchValue || "",
      role: safeRole,
      dateFrom: dateFrom || "",
      dateTo: dateTo || "",
      admin_id: req.user.admin_id,
      full_name: req.user.full_name,
    });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).send("Server Error");
  }
});

// ✅ Route: GET /logs/download to  Download The Logs page of of different user type in xls format  (Dashboard, protected by adminAuth)
router.get("/logs/download", adminAuthMiddleware, async (req, res) => {
  try {
    const client = await poolUser.connect();

    const sortField = req.query.sortField || "sn";
    const sortOrder = req.query.sortOrder || "ASC";
    const searchField = req.query.searchField || "";
    const searchValue = req.query.searchValue || "";
    const role = req.query.role || "viewer";
    const dateFrom = req.query.dateFrom || "";
    const dateTo = req.query.dateTo || "";

    // Validate sortField and role
    const validSortFields = [
      "sn",
      "full_name",
      "email",
      "action_type",
      "target",
      "created_at",
      "details",
    ];
    const safeSortField = validSortFields.includes(sortField)
      ? sortField
      : "sn";
    const safeSortOrder = sortOrder.toUpperCase() === "DESC" ? "DESC" : "ASC";
    const validRoles = ["viewer", "datareader", "admin"];
    const safeRole = validRoles.includes(role) ? role : "viewer";

    // Determine table
    const tableMap = {
      viewer: "viewerlogs",
      datareader: "datareaderlogs",
      admin: "adminlogs",
    };
    const table = tableMap[safeRole];

    // Build query (no pagination for download)
    let query = `SELECT sn, full_name, email, action_type, target, created_at, details FROM ${table}`;
    let queryParams = [];

    // Add search and date conditions
    let conditions = [];
    if (searchField && searchValue) {
      const validSearchFields = [
        "sn",
        "full_name",
        "email",
        "action_type",
        "target",
        "details",
      ];
      if (validSearchFields.includes(searchField)) {
        queryParams.push(`%${searchValue}%`);
        conditions.push(`${searchField} ILIKE $${queryParams.length}`);
      }
    }
    if (dateFrom) {
      queryParams.push(dateFrom);
      conditions.push(`created_at  >= $${queryParams.length}`);
    }
    if (dateTo) {
      queryParams.push(dateTo);
      conditions.push(`created_at  <= $${queryParams.length}`);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    // Add sorting
    query += ` ORDER BY ${safeSortField} ${safeSortOrder}`;

    console.log("Download Query:", query, "Params:", queryParams);

    // Execute query
    const result = await client.query(query, queryParams);
    const logs = result.rows;

    client.release();

    // Create Excel workbook
    const worksheetData = logs.map((log) => ({
      ID: log.sn,
      Name: log.full_name,
      Email: log.email,
      "Action Type": log.action_type,
      Target: log.target,
      Timestamp: log.created_at,
      Details: log.details,
    }));

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `${safeRole}_logs`);

    // Generate buffer
    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });

    // Set headers for download
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${safeRole}_logs_${new Date().toISOString().split("T")[0]
      }.xlsx`
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.send(buffer);
  } catch (err) {
    console.error("Error:", err);
    res.status(500).send("Server Error");
  }
});

// ✅ Route: GET /manage Get Page to  To manage all the layers on repository   (Dashboard, protected by adminAuth)
router.get("/manage", adminAuthMiddleware, async (req, res) => {
  try {
    const client = await poolUser.connect();

    const page = parseInt(req.query.page) || 1;
    const limit = 10; // Adjust as needed
    const offset = (page - 1) * limit;
    const sortField = req.query.sortField || "sn";
    const sortOrder = req.query.sortOrder || "ASC";
    const searchField = req.query.searchField || "";
    const searchValue = req.query.searchValue || "";

    // Validate sortField to prevent SQL injection
    const validSortFields = [
      "sn",
      "title",
      "file_name",
      "theme",
      "visibility",
      "edit_mode",
    ];
    const safeSortField = validSortFields.includes(sortField)
      ? sortField
      : "sn";
    const safeSortOrder = sortOrder.toUpperCase() === "DESC" ? "DESC" : "ASC";

    // Build query
    let query =
      "SELECT sn, file_name, title, theme, visibility, edit_mode FROM catalog";
    let countQuery = "SELECT COUNT(*) FROM catalog";
    let queryParams = [];
    let countParams = [];

    // Add search condition if provided
    if (searchField && searchValue) {
      const validSearchFields = ["title", "file_name", "theme"];
      if (validSearchFields.includes(searchField)) {
        queryParams.push(`%${searchValue}%`);
        countParams.push(`%${searchValue}%`);
        query += ` WHERE ${searchField} ILIKE $${queryParams.length}`;
        countQuery += ` WHERE ${searchField} ILIKE $${countParams.length}`;
      }
    }

    // Add sorting
    query += ` ORDER BY ${safeSortField} ${safeSortOrder}`;

    // Add pagination
    queryParams.push(limit, offset);
    query += ` LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`;

    console.log("Query:", query, "Params:", queryParams); // Debugging
    console.log("Count Query:", countQuery, "Count Params:", countParams); // Debugging

    // Execute queries
    const result = await client.query(query, queryParams);
    const catalogItems = result.rows;

    const countResult = await client.query(countQuery, countParams);
    const totalItems = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalItems / limit);

    client.release();

    res.status(200).render("adminCatalogManage", {
      catalogItems,
      currentPage: page,
      totalPages,
      sortField: safeSortField,
      sortOrder: safeSortOrder,
      searchField: searchField || "",
      searchValue: searchValue || "",
      admin_id: req.user.admin_id,
      full_name: req.user.full_name,
    });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).send("Server Error");
  }
});

// ✅ Route: POST /visibility Toggle visibility of layers on repository   (Dashboard, protected by adminAuth)
router.post("/visibility", adminAuthMiddleware, async (req, res) => {
  const { id, visibility } = req.body;

  if (id == null || visibility == null) {
    return res.status(400).json({ error: "Invalid request" });
  }

  try {
    const client = await poolUser.connect();
    const query = `
            UPDATE catalog
            SET visibility = $1
            WHERE sn = $2
        `;
    const values = [visibility, id];

    await client.query(query, values);
    client.release(); // Ensure the connection is released
    res
      .status(201)
      .json({ success: true, icon: "success", message: "Visibility Updated" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server Error" });
  }
});

// ✅ Route: POST /editmode Toggle editmode of layers on repository   (Dashboard, protected by adminAuth)
router.post("/editmode", adminAuthMiddleware, async (req, res) => {
  const { id, edit_mode } = req.body;

  if (id == null || edit_mode == null) {
    return res.status(400).json({ error: "Invalid request" });
  }

  try {
    const client = await poolUser.connect();
    const query = `
            UPDATE catalog
            SET edit_mode = $1
            WHERE sn = $2
        `;
    const values = [edit_mode, id];

    await client.query(query, values);
    client.release(); // Ensure the connection is released
    res
      .status(201)
      .json({ success: true, icon: "success", message: "Edit Mode Updated" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server Error" });
  }
});

// ✅ Route: GET /roles Get all Registered Users  (Dashboard, protected by adminAuth)
router.get("/roles", adminAuthMiddleware, async (req, res) => {
  try {
    const client = await poolUser.connect();

    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const offset = (page - 1) * limit;
    const sortField = req.query.sortField || "user_id";
    const sortOrder = req.query.sortOrder || "ASC";
    const searchField = req.query.searchField || "";
    const searchValue = req.query.searchValue || "";
    const role = req.query.role || "all";

    console.log("Request Query:", {
      page,
      sortField,
      sortOrder,
      searchField,
      searchValue,
      role,
    });

    const validSortFields = [
      "user_id",
      "first_name",
      "last_name",
      "email",
      "organization",
      "designation",
      "role",
    ];
    const safeSortField = validSortFields.includes(sortField)
      ? sortField
      : "user_id";
    const safeSortOrder = sortOrder.toUpperCase() === "DESC" ? "DESC" : "ASC";

    let query = `
      SELECT 
        user_id, 
        first_name, 
        last_name, 
        email, 
        organization, 
        designation, 
        role, 
        COALESCE(id_proof, NULL) AS id_proof
      FROM registered
      WHERE 1=1
    `;
    let countQuery = "SELECT COUNT(*) FROM registered WHERE 1=1";
    let queryParams = [];
    let countParams = [];

    // Add role filter
    if (role !== "all") {
      query += ` AND role = $${queryParams.length + 1}`;
      countQuery += ` AND role = $${countParams.length + 1}`;
      queryParams.push(role);
      countParams.push(role);
    }

    // Add search condition
    if (searchField && searchValue) {
      const validSearchFields = [
        "first_name",
        "last_name",
        "email",
        "organization",
        "designation",
      ];
      if (validSearchFields.includes(searchField)) {
        queryParams.push(`%${searchValue}%`);
        countParams.push(`%${searchValue}%`);
        query += ` AND ${searchField} ILIKE $${queryParams.length}`;
        countQuery += ` AND ${searchField} ILIKE $${countParams.length}`;
      }
    }

    // Add sorting
    query += ` ORDER BY ${safeSortField} ${safeSortOrder}`;

    // Add pagination
    queryParams.push(limit, offset);
    query += ` LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`;

    console.log("Query:", query, "Params:", queryParams);
    console.log("Count Query:", countQuery, "Count Params:", countParams);

    const initresult = await client.query(query, queryParams);
    const result = initresult.rows.map((item) => ({
      user_id: item.user_id,
      first_name: item.first_name || "",
      last_name: item.last_name || "",
      email: item.email,
      organization: item.organization || "",
      designation: item.designation || "",
      role: item.role || "viewer",
      id_proof: item.id_proof
        ? item.id_proof.toString("base64")
        : "/images/default-profile.png",
    }));

    const userItems = result;

    const countResult = await client.query(countQuery, countParams);
    const totalUsers = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalUsers / limit);

    console.log("Fetched Rows:", userItems.length, "Total Users:", totalUsers);

    client.release();

    res.status(200).render("adminRoles", {
      userItems,
      currentPage: page,
      totalPages,
      sortField: safeSortField,
      sortOrder: safeSortOrder,
      searchField: searchField || "",
      searchValue: searchValue || "",
      role: role || "all",
      admin_id: req.user.admin_id,
      full_name: req.user.full_name,
    });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).send("Server Error");
  }
});

// ✅ Route: POST /roles Toggle Role of Registered Users  (Dashboard, protected by adminAuth)
router.post("/roles", adminAuthMiddleware, async (req, res) => {
  const { email, role } = req.body;
  console.log(req.body);

  console.log(req.user);
  const admin_fullname = req.user.full_name;
  const admin_email = req.user.email;
  const admin_organization = req.user.organization;
  const admin_role = req.user.admin_role;

  if (admin_role != "root") {
    res
      .status(200)
      .json({
        title: "Permission Denied",
        message: "Only Root User Can Update Role",
        success: true,
        icon: "warning",
      });
    return;
  }

  if (role === "root") {
    res
      .status(200)
      .json({
        title: "Oops",
        message: "Adding Root User Not AlLowed",
        success: true,
        icon: "warning",
      });
    return;
  }
  // Validate privilege value
  const validPrivileges = ["viewer", "datareader", "admin", "blocked"];
  if (!email || !role || !validPrivileges.includes(role)) {
    return res.status(400).json({ error: "Invalid request" });
  }

  try {
    const client = await poolUser.connect();

    const getquery = `
        SELECT first_name, last_name, email, organization, designation, role, password FROM registered WHERE email= $1
        `;
    const getqueryvalue = [email];
    const getqueryresult = await client.query(getquery, getqueryvalue);

    const full_name =
      getqueryresult.rows[0].first_name + getqueryresult.rows[0].last_name;

    const organization = getqueryresult.rows[0].organization;
    const designation = getqueryresult.rows[0].designation;
    const password = getqueryresult.rows[0].password;
    const existingrole = getqueryresult.rows[0].role;

    if (existingrole === "root") {
      res
        .status(200)
        .json({
          title: "Oops",
          message: "Root Update Not Allowed",
          success: true,
          icon: "warning",
        });
      return;
    }

    const query = `
            UPDATE registered
            SET role = $1
            WHERE email = $2
        `;
    const values = [role, email];

    if (role === "admin") {
      console.log("role to admin");

      const query = `
            INSERT INTO admins(full_name, email, organization, designation, admin_id, password) 
            VALUES($1, $2, $3, $4, $5, $6)
            `;
      const values = [
        full_name,
        email,
        organization,
        designation,
        email,
        password,
      ];
      client.query(query, values);

      const queryforlogs = `
            INSERT INTO adminlogs(email, organization, full_name, action_type, target, details) 
            VALUES($1, $2, $3, $4, $5, $6)
            `;

      const action_type = "role change";
      const details = `${existingrole} to ${role}`;
      const valuesforlogs = [
        admin_email,
        admin_organization,
        admin_fullname,
        action_type,
        email,
        details,
      ];
      client.query(queryforlogs, valuesforlogs);
    } else if (role === "viewer" || role === "datareader" || role === "blocked") {
      // console.log(`role to ${role}`);

      const query = `
            DELETE FROM admins WHERE email = $1
            `;
      const values = [email];
      client.query(query, values);

      const queryforlogs = `
            INSERT INTO adminlogs(email, organization, full_name, action_type, target, details) 
            VALUES($1, $2, $3, $4, $5, $6)
            `;

      const action_type = "role change";
      const details = `${existingrole} to ${role}`;
      const valuesforlogs = [
        admin_email,
        admin_organization,
        admin_fullname,
        action_type,
        email,
        details,
      ];
      client.query(queryforlogs, valuesforlogs);
    }

    await client.query(query, values);
    client.release();
    res
      .status(200)
      .json({
        title: "",
        message: "Role Updated",
        success: true,
        icon: "success",
      });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({
        title: "",
        message: "Server Error",
        success: true,
        icon: "Danger",
      });
  }
});

// ✅ Route: GET /queries Get all Users Queries  (Dashboard, protected by adminAuth)
router.get("/queries", adminAuthMiddleware, async (req, res) => {
  try {
    const client = await poolUser.connect();

    const page = parseInt(req.query.page) || 1;
    const limit = 10; // Adjust as needed
    const offset = (page - 1) * limit;
    const sortField = req.query.sortField || "queryid";
    const sortOrder = req.query.sortOrder || "ASC";
    const searchField = req.query.searchField || "";
    const searchValue = req.query.searchValue || "";
    const isresolved = req.query.isresolved || "false";
    const dateFrom = req.query.dateFrom || "";
    const dateTo = req.query.dateTo || "";

    // Validate sortField to prevent SQL injection
    const validSortFields = [
      "queryid",
      "full_name",
      "email",
      "mobile",
      "reason",
      "occupation",
      "querydate",
      "message",
    ];
    const safeSortField = validSortFields.includes(sortField)
      ? sortField
      : "queryid";
    const safeSortOrder = sortOrder.toUpperCase() === "DESC" ? "DESC" : "ASC";

    // Build query
    let query =
      "SELECT queryid, full_name, email, mobile, reason, occupation, querydate, message, isresolved FROM queries";
    let countQuery = "SELECT COUNT(*) FROM queries";
    let queryParams = [];
    let countParams = [];
    let conditions = [];

    // Add search condition
    if (searchField && searchValue) {
      const validSearchFields = [
        "full_name",
        "email",
        "mobile",
        "reason",
        "occupation",
        "message",
      ];
      if (validSearchFields.includes(searchField)) {
        queryParams.push(`%${searchValue}%`);
        countParams.push(`%${searchValue}%`);
        conditions.push(`${searchField} ILIKE $${queryParams.length}`);
      }
    }

    // Add isresolved filter
    if (isresolved === "true" || isresolved === "false") {
      queryParams.push(isresolved === "true");
      countParams.push(isresolved === "true");
      conditions.push(`isresolved = $${queryParams.length}`);
    }

    // Add date filters
    if (dateFrom) {
      queryParams.push(dateFrom);
      countParams.push(dateFrom);
      conditions.push(`querydate >= $${queryParams.length}`);
    }
    if (dateTo) {
      queryParams.push(dateTo);
      countParams.push(dateTo);
      conditions.push(`querydate <= $${queryParams.length}`);
    }

    // Combine conditions
    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
      countQuery += " WHERE " + conditions.join(" AND ");
    }

    // Add sorting
    query += ` ORDER BY ${safeSortField} ${safeSortOrder}`;

    // Add pagination
    queryParams.push(limit, offset);
    query += ` LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`;

    console.log("Query:", query, "Params:", queryParams);
    console.log("Count Query:", countQuery, "Count Params:", countParams);

    // Execute queries
    const result = await client.query(query, queryParams);
    const queries = result.rows;

    const countResult = await client.query(countQuery, countParams);
    const totalItems = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalItems / limit);

    client.release();

    res.status(200).render("adminQueries", {
      queries,
      currentPage: page,
      totalPages,
      sortField: safeSortField,
      sortOrder: safeSortOrder,
      searchField: searchField || "",
      searchValue: searchValue || "",
      isresolved: isresolved || "false",
      dateFrom: dateFrom || "",
      dateTo: dateTo || "",
      admin_id: req.user.admin_id,
      full_name: req.user.full_name,
    });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).send("Server Error");
  }
});

// ✅ Route: POST /queries Reply and Toggle Query status  (Dashboard, protected by adminAuth)
router.post("/queries", adminAuthMiddleware, async (req, res) => {

  const { action, queryid, email, reply, subject, request, fullname } = req.body;
  let client;
  try {
    client = await poolUser.connect();
    let query = "";
    let params = [];

    if (action === "ignore") {
      try {
        query = `
                    UPDATE queries
                    SET isresolved=$1
                    WHERE queryid=$2
                `;
        params = [true, queryid];

        console.log(query);
        console.log(params);

        await client.query(query, params);
        const data = { message: "Ignored", title: "Alert", icon: "alert" };
        return res.status(400).json(data);
      } catch (error) {
        console.error("Error in sending reply via email:", error);
        const data = {
          message: "something went wrong, Try again!",
          title: "Error",
          icon: "error",
        };
        return res.status(400).json(data);
      }
    } else if (action === "reply") {
      try {
        if (!validator.isEmail(email)) {
          const data = {
            message: "Invalid email",
            title: "Alert",
            icon: "danger",
          };
          return res.status(400).json(data);
        }

        // Send reply via email
        await transporter.sendMail({
          from: process.env.email,
          to: req.body.email,
          subject: "📩 ASSAM-SDR | Response to Your Query",
          html: `
    <div style="
      font-family: Arial, sans-serif;
      background: #f9fbfd;
      padding: 25px;
      border-radius: 10px;
      max-width: 650px;
      margin: auto;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    ">
      <h2 style="color: #007bff; text-align:center;">
        ASSAM-SDR | Query Response
      </h2>

      <p style="font-size: 16px; color: #333;">
        Dear <strong>${escapeHtml(fullname || "User")}</strong>,
      </p>

      <p style="font-size: 15px; color: #333;">
        Thank you for reaching out to the <strong>ASSAM-SDR Support Team</strong>.
        Below is the detailed summary of your query and our official response:
      </p>

      <!-- Subject Section -->
      <div style="
        background: #fff7e6;
        padding: 15px;
        border-left: 5px solid #ffb100;
        margin-top: 20px;
        border-radius: 6px;
      ">
        <p style="margin: 0; color: #555;"><strong>Subject:</strong></p>
        <p style="margin: 8px 0; color: #333; white-space: pre-line;">
          ${subject}
        </p>
      </div>

      <!-- User Query Section -->
      <div style="
        background: #eef4ff;
        padding: 15px;
        border-left: 5px solid #007bff;
        margin-top: 20px;
        border-radius: 6px;
      ">
        <p style="margin: 0; color: #555;"><strong>Your Query:</strong></p>
        <p style="margin: 8px 0; color: #333; white-space: pre-line;">
          ${request}
        </p>
      </div>

      <!-- Response Section -->
      <div style="
        background: #f0fff3;
        padding: 15px;
        border-left: 5px solid #28a745;
        margin-top: 20px;
        border-radius: 6px;
      ">
        <p style="margin: 0; color: #555;"><strong>Our Response:</strong></p>
        <p style="margin: 8px 0; color: #333; white-space: pre-line;">
          ${reply}
        </p>
      </div>

      <p style="font-size: 14px; color: #555; margin-top: 25px;">
        If you have any further questions, please feel free to reply to this email.
      </p>

      <p style="font-size: 14px; color: #555;">
        Regards,<br>
        <strong>ASSAM-SDR Support Team</strong><br>
        <em>Assam State Space Application Centre (ASSAC)</em><br>
        Department of Science & Technology, Govt. of Assam
      </p>

      <hr style="margin-top: 20px; border: none; border-top: 1px solid #ddd;">
      <p style="font-size: 12px; color: #999; text-align: center;">
        This is an automated message from the ASSAM-SDR portal. Please do not share sensitive information in your reply.
      </p>
    </div>
  `,
        });

        // 🔐 Reuse existing client instead of creating a new one (fixes double-connect bug)
        query = `
                UPDATE queries
                SET isresolved=$1
                WHERE queryid=$2
                `;
        params = [true, queryid];
        await client.query(query, params);

        const data = {
          message: "reply sent successfully",
          title: "Sent",
          icon: "success",
        };
        return res.status(200).json(data);
      } catch (err) {
        console.error("Error in sending reply via email:", err);
        const error = { message: "something went wrong" };
        console.error(error)

        const data = {
          message: "something went wrong, Try again!",
          title: "Error",
          icon: "error",
        };
        return res.status(400).json(data);
      }
    }
  } catch (error) {
    console.error("Query handling error:", error.message);
    const data = { message: "Something went wrong", title: "Oops?", icon: "danger" };
    return res.status(400).json(data);
  } finally {
    if (client) client.release();
  }
});

// ✅ Route: POST /logout Logout  (Dashboard, protected by adminAuth)
router.post("/logout", adminAuthMiddleware, (req, res) => {
  try {
    // Clear the cookie containing the token
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    });

    // Send a success response
    const data = {
      message: "Logout successful",
      title: "Logged Out",
      icon: "success",
      redirect: "\\",
    };
    console.log(data);
    return res.json(data);
  } catch (error) {
    console.error(error);
    const data = { message: "Logout failed", title: "Error", icon: "error" };

    return res.status(500).json(data);
  }
});

// ✅ Route: GET /* 404 Not found page  (Dashboard, protected by adminAuth)
router.get("*", (req, res) => {
  res.render("404");
});

// ✅ Export the router
export default router;
