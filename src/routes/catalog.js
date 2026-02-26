
// ✅ ES6 Imports
import express from "express";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import userAuthMiddleware from "../middleware/userAuth.js";
import axios from "axios";
import cookieParser from "cookie-parser";
import config from '../../config.js';
import { poolUser, getPoolByTheme } from "../db/connection.js";
import pg from 'pg';


// ✅ Create Express router
const router = express.Router();

// ✅ Apply middleware
router.use(cookieParser());
router.use(bodyParser.json());
router.use(bodyParser.urlencoded({ extended: true }));
dotenv.config();

// ✅ Create New database Connection
function createPool(database) {
  return new pg.Pool({
    user: process.env.db_user,
    host: process.env.db_host,
    database: database,
    password: process.env.db_pw,
    port: process.env.db_port,
  });
}
// 🔒 Optional: whitelist known Themes/db (recommended)
const whitelistTheme = config.whitelistTheme;

// 🔒 Validate Theme name (filename)
function isValidTheme(theme) {
  // returns true or false
  return whitelistTheme.includes(theme); 
}

// 🔒 Validate File name (filename)
async function isValidFile(theme, fileName) {
  if (typeof theme !== 'string' || typeof fileName !== 'string') {
    return false;
  }
  try {
    // checks if file exists
    const result = await poolUser.query(
      `SELECT EXISTS (
         SELECT 1 FROM catalog
         WHERE theme = $1 AND file_name = $2 AND is_published = TRUE
       ) AS exists`,
      [theme, fileName]
    );

    return result.rows[0].exists === true;
  } catch (err) {
    console.error('Database error in isValidFile:', err);
    return false;
  }
}

// ✅ Route:GET  to get all info of a particular file
router.get("/fields/:theme/:fileName", async (req, res) => {
  const { theme, fileName } = req.params;
  try {
          // 🔐 Validate theme
    if (!isValidTheme(theme)) {  
      return res.status(400).json({ error: "Invalid theme" });
    }
              // 🔐 Validate file

        if (!(await isValidFile(theme, fileName))) {   
      return res.status(400).json({ error: "Invalid or unpublished file" });
    }
//  create new connection
    const pool = getPoolByTheme(theme);
    // establish  connection
      const client = await pool.connect();

    const result = await client.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
      [fileName]
    );

    const fields = result.rows
      .map(r => r.column_name.toLowerCase())
      .filter(name => !['geom', 'gid', 'globalid', 'longitude', 'latitude'].includes(name));

    client.release();
    res.json(fields);
  } catch (error) {
    console.error("Error fetching fields:", error);
    res.status(500).send("Error fetching fields");
  }
});

// ✅ Route:GET fecth all districts 
router.get("/districts", async (req, res) => {
  try {
    const theme = 'commonshapefiles'
    const fileName = process.env.districtfile;
    const field = process.env.districtfilefield;

    const pool = getPoolByTheme(theme);
    const client = await pool.connect();

    const result = await client.query(
      `SELECT DISTINCT "${field}" FROM "${fileName}" ORDER BY "${field}"`
    );
    const values = result.rows.map((row) => row[field]);
    client.release();
    res.json(values);
  } catch (error) {
    console.error("Error fetching fields:", error);
    res.status(500).send("Error fetching fields");
  }
});

// ✅ Route:GET endpoint to fetch values for a field
router.get("/values/:theme/:fileName/:field", async (req, res) => {
  const { theme, fileName, field } = req.params;
  try {

    if (!isValidTheme(theme)) {  
      return res.status(400).json({ error: "Invalid theme" });
    }
    if (!(await isValidFile(theme, fileName))) {   
      return res.status(400).json({ error: "Invalid or unpublished file" });
    }
 
    const pool = getPoolByTheme(theme);

    const client = await pool.connect();

    const result = await client.query(
      `SELECT DISTINCT "${field}" FROM "${fileName}" ORDER BY "${field}"`
    );
    const values = result.rows.map((row) => row[field]);
    client.release();
    res.json(values);
  } catch (error) {
    console.error("Error fetching values:", error);
    res.status(500).send("Error fetching values");
  }
});

// ✅ Route:GET  to get data request form
router.get("/:id/view", async (req, res) => {
  const id = req.params.id;
  try {
    const client = await poolUser.connect();
    const result = await client.query(
      `SELECT file_name, title, theme FROM catalog WHERE file_name = $1`,
      [id]
    );
    const catalogItems = result.rows;
    client.release();
    res.render("catalogView", { catalogItems });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// ✅ Route:POST api to handle user data request
router.post("/:id/filerequest", userAuthMiddleware, async (req, res) => {
  const { type, theme, fileName, conditions, operator } = req.body;

  const email = req.user.email;
    const role = req.user.role;

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
      icon: "warning"});

   }

  console.log(req.user);
  
  let request_status = "pending";
  if(role==='admin' || role==='root' || role==='datareader'){
     request_status = "approved"
  }
  try {
    const client = await poolUser.connect();
    // await poolAdministrative.connect() :
    let queryCondition = null;
    let fields = [];
    let values = [];

    if (type === "query" && conditions?.length) {
      // Construct query condition
      const whereClauses = conditions.map((cond) => {
        fields.push(cond.field);
        values.push(cond.values);
        const escapedValues = cond.values
          .map((val) => `'${val.replace(/'/g, "''")}'`)
          .join(", ");
        return `${cond.field} IN (${escapedValues})`;
      });
      queryCondition = whereClauses.join(` ${operator} `);
    }

    // Store request info in requests table

    const insertQuery = `
      INSERT INTO requests (email, file_name, theme, type, fields, values, condition, query_condition, request_status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `;
    const insertValues = [
      email,
      fileName,
      theme,
      type,
      JSON.stringify(fields), // Store fields as JSON
      JSON.stringify(values), // Store values as JSON
      conditions,
      queryCondition,
      request_status,
    ];
    const insertResult = await client.query(insertQuery, insertValues);

const findOrganizationquery = `SELECT first_name, last_name, organization FROM registered WHERE email=$1`
const findOrganization = await client.query(findOrganizationquery, [email])
    const organization = findOrganization.rows[0].organization;

    const full_name =`${findOrganization.rows[0].first_name} ${findOrganization.rows[0].last_name}`;
    const action_type="request"
    const insertedSn = insertResult.rows[0].id;
    let logsquery;
    let actiononfo;
    if(role==='admin' || role==='root'){
        logsquery = `INSERT INTO adminlogs ( full_name, email, organization, action_type, target, details)
        VALUES ($1, $2, $3, $4, $5, $6) `;
        actiononfo = `request no: ${insertedSn} Auto approved`

    }else if(role==='datareader'){
        logsquery = `INSERT INTO datareaderlogs ( full_name, email, organization, action_type, target, details)
        VALUES ($1, $2, $3, $4, $5, $6) `;

        actiononfo = `request no: ${insertedSn} Auto approved`

    }else if(role==='viewer'){
        logsquery = `INSERT INTO viewerlogs ( full_name, email, organization, action_type, target, details)
        VALUES ($1, $2, $3, $4, $5, $6) `;
        actiononfo = `request no: ${insertedSn} created`

    }        
        const logsparams = [full_name, email, organization,  action_type, fileName, actiononfo];
   await client.query(logsquery, logsparams);

    client.release();

    res.json({
      success: true,
      icon: "success",
      message: `Request ID ${insertResult.rows[0].id} has been processed`,
    });
  } catch (error) {
    console.error("Error processing request:", error);
    res
      .status(500)
      .json({ success: false, message: "Error processing request" });
  }
});

//✅ Route:GET api to  get meta data iformation of a file
router.get("/:id/metainfo", async (req, res) => {
  // console.log("router.get('/:id', async (req, res) ---> start");

  const id = req.params.id;
  console.log(id);
  // res.render("catalogView")
  try {
    const client = await poolUser.connect();
    const result = await client.query(
      `SELECT * FROM catalog where file_name = $1`,
      [id]
    );
    const catalogItems = result.rows;
    catalogItems.forEach((item) => {
      if (item.uploaddate) {
        item.uploaddate = new Date(item.uploaddate).toLocaleString("en-IN"); // Format uploaddate here
      }
    });
    console.log(catalogItems);
    client.release();
    res.render("metadata", { catalogItems });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});



// ✅ Route:GET the catalog page
router.get("/", async (req, res) => {
  try {
    res.render("catalog");
  } catch (err) {
    console.error("Error rendering catalog page:", err.stack);
    res.status(500).send("Server Error: Unable to render catalog page");
  }
});

//✅ Route:GET API endpoint for filtered catague data
router.post("/", async (req, res) => {
  try {
    const {
      theme = "all",
      year = "all",
      dateFrom,
      dateTo,
      scale = "all",
      tag = "all",
      search = "",
      sort = "title",
      order = "desc",
      page = 1,
      limit = 9,
      district = "all",  
      department = "all",  

    } = req.body;

    console.log("Received filters:", req.body); // Debug: Log incoming filters

    const client = await poolUser.connect();
    let query =
      "SELECT * FROM catalog WHERE visibility = true AND is_published = true";
    const params = [];
    let paramIndex = 1;

    // Theme filter
    if (theme !== "all") {
      query += ` AND theme = $${paramIndex++}`;
      params.push(theme);
    }

    // Year filter
    if (year !== "all") {
      query += ` AND EXTRACT(YEAR FROM source_date) = $${paramIndex++}`;
      params.push(parseInt(year));
    }

    // Date range filter
    if (dateFrom) {
      query += ` AND source_date >= $${paramIndex++}`;
      params.push(dateFrom);
    }
    if (dateTo) {
      query += ` AND source_date <= $${paramIndex++}`;
      params.push(dateTo);
    }

    // Scale filter
    if (scale !== "all") {
      query += ` AND scale = $${paramIndex++}`;
      params.push(scale);
    }

    // Dist filter
    if (district !== "all") {
  query += ` AND district = $${paramIndex++}`;
  params.push(district);
}

// department filter
if (department !== "all") {
  query += ` AND department = $${paramIndex++}`;
  params.push(department);
}

    // Tag filter (assuming tags are comma-separated)
    if (tag !== "all") {
      // Check if tags column exists
      query += ` AND tag = $${paramIndex++}`;
  params.push(tag);
    }

    // Search by title
    if (search) {
      query += ` AND title ILIKE $${paramIndex++}`;
      params.push(`%${search}%`);
    }

    // Count total items for pagination
    const countQuery = `SELECT COUNT(*) FROM (${query}) AS filtered`;
    console.log("Count query:", countQuery, "Params:", params); // Debug: Log count query
    const countResult = await client.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    // Sorting and pagination
    const validSortFields = [
      "title",
      "source_date",
      "publisher",
      "file_type",
      "theme",
      "scale",
      "metadata_date",
    ];
    const sortField = validSortFields.includes(sort) ? sort : "title";
    const sortOrder = order.toLowerCase() === "asc" ? "ASC" : "DESC";
    query += ` ORDER BY ${sortField} ${sortOrder}`;
    query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, (page - 1) * limit);

    // Execute query
    console.log("Final query:", query, "Params:", params); // Debug: Log final query
    const result = await client.query(query, params);
    client.release();

    // Add placeholder image and handle null values
    const items = result.rows.map((item) => ({
      ...item,
      img: item.img || "https://via.placeholder.com/150",
      tags: item.tags || "",
      source_date: item.source_date || new Date(), // Fallback for null source_date
      file_type: item.file_type || "Unknown",
      scale: item.scale || "Unknown",
      theme: item.theme || "Unknown",
    }));

    res.json({ items, total });
  } catch (err) {
    console.error("API error:", err.stack);
    res.status(500).json({ error: `Server Error: ${err.message}` });
  }
});

// ✅ Route:GET wms in buffer format
router.get("/wms", async (req, res) => {
  try {
    const wmsUrl = `${process.env.geoserverurl}/${process.env.workspace}/wms`;

    const requiredParams = ["SERVICE", "REQUEST", "LAYERS"];
    for (const param of requiredParams) {
      if (!req.query[param] && !req.query[param.toLowerCase()]) {
        return res.status(400).send(`Missing required WMS parameter: ${param}`);
      }
    }

    const response = await axios.get(wmsUrl, {
      params: req.query,
      responseType: "arraybuffer",
      timeout: 10000,
    });

    for (const header in response.headers) {
      res.setHeader(header, response.headers[header]);
    }

    res.send(response.data);
  } catch (error) {
    console.error("Error in Express WMS proxy:", error.message);
    res.status(500).send("Error processing WMS request.");
  }
});



// ✅ Route:GET router get thumbnail of a layer

router.get("/getthumbnail/:theme/:layer", async (req, res) => {
  try {
    const layer = req.params.layer
        const theme = req.params.theme

            if (!isValidTheme(theme)) {  
      return res.status(400).json({ error: "Invalid theme" });
    }
     if (!(await isValidFile(theme, layer))) {   
      return res.status(400).json({ error: "Invalid or unpublished file" });
    }    


    if ( !layer) {
      return res.status(400).json({ error: "workspace and layer are required" });
    }

    // Set default format
const imgFormat = "image/png"; // or "image/svg+xml"

        const pool = createPool(theme);


     // 1. Get bbox from PostGIS
    const bboxQuery = `
      SELECT ST_Extent(geom) AS bbox
      FROM ${layer};
    `;
    const result = await pool.query(bboxQuery);    

    if (!result.rows[0].bbox) {
      return res.status(404).json({ error: "No geometry found" });
    }

    // bbox string looks like "BOX(minx miny,maxx maxy)"
    const bboxString = result.rows[0].bbox;
    const match = bboxString.match(/BOX\(([-0-9.]+) ([-0-9.]+),([-0-9.]+) ([-0-9.]+)\)/);

    if (!match) {
      return res.status(500).json({ error: "Invalid bbox format" });
    }

const [, minx, miny, maxx, maxy] = match;

console.log(match);


    // --- Step 2: Build GetMap URL ---
    // ${process.env.geoserverurl}/${process.env.workspace}
    const getMapUrl = `${process.env.geoserverurl}/${process.env.workspace}/wms?service=WMS&version=1.1.0&request=GetMap&layers=${process.env.workspace}:${layer}&bbox=${minx},${miny},${maxx},${maxy}&width=800&height=600&srs=EPSG:4326&format=${encodeURIComponent(imgFormat)}`;

    // --- Step 3: Fetch image ---
    const imgRes = await axios.get(getMapUrl, { responseType: "arraybuffer" });

    res.set("Content-Type", imgFormat);
    res.send(imgRes.data);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Failed to fetch map image" });
  }
});
// export routers

export default router;

