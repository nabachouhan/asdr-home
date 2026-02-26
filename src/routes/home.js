
// ✅ ES6 Imports
import express from "express";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import { getPoolByTheme, poolUser } from "../db/connection.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import userAuthMiddleware from "../middleware/userAuth.js";
import optionalAuth from "../middleware/optional.js";
import { exec } from "child_process";
import AdmZip from "adm-zip";
import { rimraf } from "rimraf";
import cookieParser from "cookie-parser";

// ✅ For __dirname in ES6 modules
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Initialize dotenv to load environment variables
dotenv.config();

// ✅ Create router
const router = express.Router();

// ✅ Apply global middlewares
router.use(cookieParser());
router.use(bodyParser.json());
router.use(bodyParser.urlencoded({ extended: true }));


const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fieldSize: .1* 1024 * 1024, // .1 MB per field
    fields: 12,                 // max number of text fields
  }
});


// ✅ home route
router.get("/", optionalAuth, async (req, res) => {
  // Dashboard stats: registered users, catalog entries, and requests

  const client = await poolUser.connect();
  const result = await client.query("SELECT Count(email) from registered");
  const result1 = await client.query("SELECT Count(file_name) from catalog");
  const result2 = await client.query("SELECT Count(file_name) from requests");
  client.release();

  // Combine counts in one object
  result.rows[0].regcount = result1.rows[0].count;
  result.rows[0].reqcount = result2.rows[0].count;

  const userItems = result.rows[0];

  // Attach user session info if logged in
  try {
    console.log(req.user.email);
    userItems.logemail = req.user.email;
    userItems.iat = req.user.iat;
    userItems.exp = req.user.exp;
  } catch (error) {
    console.error(error);
    userItems.logemail = "";
    userItems.iat = "";
    userItems.exp = "";
  }

    // Render EJS template 'home'
  res.render("home", { userItems });
});

// ✅ Requests Page (User-specific Requests List)
router.get("/requests", userAuthMiddleware, async (req, res) => {
  const client = await poolUser.connect();

  try {
        // Extract query params for filtering/sorting/pagination
    const {
      search = "",
      sort = "id",
      order = "desc",
      page = 1,
      limit = 10,
      status = "all"
    } = req.query;

    const email = req.user.email;
    const offset = (page - 1) * limit;
    let query = `SELECT * FROM requests WHERE email = $1`;
    const params = [email];
    let paramIndex = 2;

    if (search) {
      query += ` AND file_name ILIKE $${paramIndex++}`;
      params.push(`%${search}%`);
    }

    if (status !== "all") {
      query += ` AND request_status = $${paramIndex++}`;
      params.push(status);
    }

    // Count total records for pagination
    const countQuery = `SELECT COUNT(*) FROM (${query}) AS count_sub`;
    const countResult = await client.query(countQuery, params);
    const totalItems = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalItems / limit);

    // Validate sorting and order
    const allowedSort = ["id", "file_name", "created_at"];
    const sortBy = allowedSort.includes(sort) ? sort : "id";
    const sortOrder = order.toLowerCase() === "asc" ? "ASC" : "DESC";

        // Apply sorting and pagination
    query += ` ORDER BY ${sortBy} ${sortOrder} LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    const result = await client.query(query, params);
    const userItems = result.rows;

        // Format timestamps
    userItems.forEach((item) => {
      if (item.rtime) {
        item.rtime = new Date(item.rtime).toLocaleString("en-IN");
      }
    });

//✅  Render EJS template with request data
    res.render("userRequests", {
      userItems,
      search,
      sort,
      order,
      status,
      currentPage: parseInt(page),
      totalPages,
    });
  } catch (err) {
    console.error("Error in /requests:", err);
    res.status(500).send("Internal Server Error");
  } finally {
    client.release();
  }
});


//✅ user Profile Page

router.get("/profile", userAuthMiddleware, async (req, res) => {
  const email = req.user.email;
  console.log(email);
  const client = await poolUser.connect();
  const result = await client.query(
    `SELECT *  FROM registered WHERE email = $1`,
    [email]
  );
  client.release();
  const userItems = result.rows;

  userItems.forEach((item) => {
    if (item.registereddate) {
      item.registereddate = new Date(item.registereddate).toLocaleString(
        "en-IN"
      ); // Format rtime here
    }
    if (item.id_proof) {
      const imageBuffer = item.id_proof;
      item.id_proof = imageBuffer.toString("base64");
    }
  });

  res.render("profile", { userItems });
});

 // ✅ User Query Submit Form

router.post("/query", upload.none(), async (req, res) => {

  console.log(req.body);

  const {
    full_name,
    email,
    mobile,
    occupation,
    reason,
    message,
  } = req.body;

  try {
    if (!full_name || !email || !mobile || !occupation || !reason || !message) {
      const data = {
        message: "All fields are required",
        title: "Warning",
        icon: "warning",
      };
      return res.json(data);
    }

    const validateIndianPhoneNumber = (mobile) => {
      const phoneRegex = /^[6-9]\d{9}$/;
      return phoneRegex.test(mobile);
    };

    if (!validateIndianPhoneNumber(mobile)) {
      const data = {
        message: "Enter Valid Phone number!",
        title: "Warning",
        icon: "warning",
      };
      res.status(400);
      return res.json(data);
    }

    const isresolved = false;

    const client = await poolUser.connect();

    const querydate = new Date();

    console.log(querydate);

    const query = `
        INSERT INTO queries ( full_name, email, mobile, occupation, reason, message,querydate, isresolved)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `;
    const values = [
      full_name,
      email,
      mobile,
      occupation,
      reason,
      message,
      querydate,
      isresolved,
    ];

    await client.query(query, values);
    client.release();

    const data = {
      message: "Query submitted  Successfully",
      title: "Submitted",
      icon: "success",
      redirect: "\\",
    };
    return res.status(400).json(data);
  } catch (error) {
    const data = {
      message: "Something Went Wrong! try again",
      title: "Wrong",
      icon: "danger",
    };
    console.error("Error inserting data:", error);
    return res.status(400).json(data);
  }
});

//✅ user logout

router.post("/logout", userAuthMiddleware, (req, res) => {

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

//✅ File Download (Generate and send shapefile)
router.get("/download/:id", userAuthMiddleware, async (req, res) => {
  const { email } = req.user;
    const client1 = await poolUser.connect();
    const result = await client1.query(
    `SELECT role  FROM registered WHERE email = $1`,
    [email]
  );
  client1.release();
   const userRole = result.rows[0].role;
   if(userRole ==='blocked'){
     console.log(userRole);
     return res.status(401).json({
      message: "Your account has been blocked",
      title: "Oops",
      icon: "danger"});

   }
   

  let districtfile = process.env.districtfile
  let districtfilefield = process.env.districtfilefield
  async function generateShapefile(request) {
    const {
      id,
      file_name,
      type,
      condition,
      query_condition,
      theme
    } = request;

    let rawQuery;
    let query;
    let columnRes;

    if (type === 'query') {
      query = `SELECT * FROM ${file_name} WHERE ${query_condition}`;
    } else if (type === 'all') {
      query = `SELECT * FROM ${file_name}`;
    } else if (type === 'district') {
      let districts;
      try {
        districts = JSON.parse(condition);
        if (!Array.isArray(districts) || districts.length === 0) {
          throw new Error('Condition must be a non-empty array');
        }
      } catch (error) {
        console.error('Error parsing condition:', error);
        throw new Error(`Invalid condition format: ${error.message}`);
      }

      const sanitizedDistricts = districts
        .map(d => `'${String(d).replace(/'/g, "''")}'`)
        .join(', ');

      // Step 1: Query the column names from information_schema
       const pool = getPoolByTheme(theme);
      const gcolumn = await pool.connect();
      try {
        columnRes = await gcolumn.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = '${file_name}'
      AND column_name != 'geom'
      AND table_schema = 'public'
  `);
      } finally {
        gcolumn.release(); // Always release the connection
      }

      // Step 2: Extract column names
      const columns = columnRes.rows.map(row => `f.${row.column_name}`);


      //  Use correct SRID, e.g., 32645 if assam.geom is in UTM zone
const districtQuery = `
  WITH district_union AS (
    SELECT ST_Union(ST_Transform(geom, ST_SRID((SELECT geom FROM ${file_name} LIMIT 1)))) AS geom
    FROM ${districtfile}
    WHERE ${districtfilefield} IN (${sanitizedDistricts})
  )
  SELECT 
    ${columns.join(', ')},
    ST_Intersection(f.geom, du.geom) AS geom
  FROM ${file_name} f
  JOIN district_union du
    ON ST_Intersects(f.geom, du.geom);
`;

      rawQuery = `${districtQuery.replace(/\s+/g, ' ').trim()}`;
      query = rawQuery.replace(/"/g, '\\"');
    } else {
      throw new Error("Invalid request type");
    }

    // Escape quotes for shell-safe usage

    const requestDir = path.join(__dirname, "../../downloads", `${id}`);
    if (!fs.existsSync(requestDir)) {
      fs.mkdirSync(requestDir);
    }

    const sqlFilePathBase = path.join(requestDir, `${id}`);
    const sqlFilePath = `${sqlFilePathBase}.shp`;
    const zipFilePath = `${sqlFilePathBase}.zip`;

    console.log(
      `Executing: pgsql2shp -f "${sqlFilePath}" -h localhost -u ${process.env.db_user} ${process.env.Utility_db} "${query}"`
    );

    return new Promise((resolve, reject) => {
      exec(
        `pgsql2shp -f "${sqlFilePath}" -h localhost -u ${process.env.db_user} ${theme} "${query}"`,
        (err, stdout, stderr) => {
          if (err) {
            console.error("Query execution error:", err);
            reject(err);
          } else {
            console.log("Shapefile created!");

            const zip = new AdmZip();
            zip.addLocalFolder(requestDir);
            zip.writeZip(zipFilePath); // Create zip

            resolve(zipFilePath);
          }
        }
      );
    });
  }

  const id = req.params.id;
  const client = await poolUser.connect();

  try {
    const result = await client.query(
      "SELECT * FROM requests WHERE id = $1 AND email = $2",
      [id, email]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({
      message: "Invalid Request",
      title: "Oops",
      icon: "danger"});
    }

    const request = result.rows[0];

    try {
      const zipFilePath = await generateShapefile(request);
      console.log("Download will start ...");

      res.download(zipFilePath, (err) => {
        const requestDir = path.join(__dirname, "../../downloads", `${id}`);
        if (err) {
          console.error("Error sending file:", err);
          res.status(500).json({
      message: "File download failed",
      title: "Oops",
      icon: "danger"});
        } else {
          try {
            rimraf.sync(requestDir); // Clean temp folder
            console.log("Temporary files cleaned.");
          } catch (error) {
            console.error("Error deleting temp directory:", error);
          }
        }
      });
    } catch (err) {
      console.error("Error generating shapefile:", err);
      res.status(500).json({
      message: "Error generating shapefile",
      title: "Oops",
      icon: "danger"});
    }
  } catch (err) {
    console.error("Error fetching request:", err);
    res.status(500).json({
      message: "something went wrong",
      title: "Oops",
      icon: "danger"});;
  } finally {
    client.release();
  }
});



export default router;
