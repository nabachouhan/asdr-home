import { poolUser } from "./connection.js";
import pkg from 'pg';
const { Client } = pkg;

import dotenv from 'dotenv';
dotenv.config();

const databasesToCreate = [
  'administrative',
  'utility',
  'terrain',
  'landresource',
  'waterresource',
  'weatherclimate',
  'disastermanagement',
  'infrastructure',
  'commonshapefiles'
];

async function createDatabases() {
  const client = await poolUser.connect();

  try {
    console.log('Connected to PostgreSQL (default).');

    for (const dbName of databasesToCreate) {
        // ✅ Allow only letters, numbers, and underscores
      if (!/^[a-zA-Z0-9_]+$/.test(dbName)) {
        console.error(`❌ Invalid database name: ${dbName}`);
        continue;
      }
      const check = await client.query(
        "SELECT 1 FROM pg_database WHERE datname = $1",
        [dbName]
      );

      if (check.rowCount === 0) {
        await client.query(`CREATE DATABASE "${dbName}"`);
        console.log(`✅ Created database: ${dbName}`);
      } else {
        console.log(`ℹ️  Database already exists: ${dbName}`);
      }

      // Connect to each DB and run CREATE EXTENSION postgis
      const dbClient = new Client({
        user: process.env.db_user,
        host: process.env.host,
        database: dbName,
        password:  process.env.db_pw,
        port: process.env.db_port
      });

      try {
        await dbClient.connect();
        await dbClient.query('CREATE EXTENSION IF NOT EXISTS postgis');
        console.log(`📦 postgis extension enabled in ${dbName}`);
      } catch (err) {
        console.error(`❌ Error enabling postgis in ${dbName}:`, err.message);
      } finally {
        await dbClient.end();
      }
    }
  } catch (err) {
    console.error('❌ Error during database creation:', err);
  } finally {
    client.release();
    console.log('🔚 Main connection closed.');
  }
}

createDatabases();
