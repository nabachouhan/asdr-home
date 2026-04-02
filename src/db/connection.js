import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const poolUser = new Pool({
    user: process.env.db_user,
    host: process.env.db_host,
    database:process.env.db_for_user,
    password: process.env.db_pw,
    port: process.env.db_port
});



// 👉 Theme-based pool map
const themeDatabases = {
  administrative: process.env.administrative_db,
  weatherclimate: process.env.weatherclimate_db,
  landresource: process.env.landresource_db,
  waterresource: process.env.waterresource_db,
  disastermanagement: process.env.disastermanagement_db,
  infrastructure: process.env.infrastructure_db,
  utility: process.env.utility_db,
  terrain: process.env.terrain_db,
  commonshapefiles: process.env.commonshapefiles_db

};

const poolMap = {};
for (const [theme, dbName] of Object.entries(themeDatabases)) {
  poolMap[theme] = new Pool({
    user: process.env.db_user,
    host: process.env.db_host,
    database: dbName,
    password: process.env.db_pw,
    port: process.env.db_port
  });
}

// 👉 Function to get theme-based pool
function getPoolByTheme(theme) {
  const pool = poolMap[theme.toLowerCase()];
  if (!pool) throw new Error(`No theme database pool found for: ${theme}`);
  return pool;
}


export { poolUser,  getPoolByTheme };


console.log("connected")