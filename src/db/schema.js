import { poolUser } from "./connection.js";

async function createTables() {
  try {
    await poolUser.query(`
      CREATE TABLE IF NOT EXISTS registered (
        user_id SERIAL PRIMARY KEY,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        mobile VARCHAR(20) NOT NULL,
        organization VARCHAR(100) NOT NULL,
        department VARCHAR(100) NOT NULL,
        designation VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL,
        user_type VARCHAR(50) NOT NULL,
        about TEXT NOT NULL,
        registereddate TIMESTAMP NOT NULL,
        password VARCHAR(100) NOT NULL,
        id_proof BYTEA NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'viewer'
      );

      CREATE TABLE IF NOT EXISTS admins (
        sn SERIAL PRIMARY KEY,
        full_name VARCHAR(100),
        email VARCHAR(100),
        organization VARCHAR(100),
        designation VARCHAR(100),
        admin_id VARCHAR(100) NOT NULL,
        password VARCHAR(200) NOT NULL,
        admin_role VARCHAR(7) NOT NULL DEFAULT 'admin'
      );

      CREATE TABLE IF NOT EXISTS queries (
        queryid SERIAL PRIMARY KEY,
        full_name VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL,
        mobile VARCHAR(11) NOT NULL,
        occupation VARCHAR(100) NOT NULL,
        reason VARCHAR(255) NOT NULL,
        message VARCHAR(300) NOT NULL,
        querydate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        isresolved BOOLEAN NOT NULL
      ); 

     
      CREATE TABLE IF NOT EXISTS catalog (
        sn SERIAL PRIMARY KEY,
        file_name VARCHAR(100) UNIQUE NOT NULL,
        title VARCHAR(100),
        tag VARCHAR(100) DEFAULT 'all',
        district VARCHAR(100) DEFAULT 'all',
        department VARCHAR(150) DEFAULT 'all',
        spatial_coverage VARCHAR(100),
        file_type VARCHAR(15) NOT NULL,
        theme VARCHAR(30) NOT NULL,
        srid VARCHAR(10) NOT NULL,
        Publisher VARCHAR(30),
        Language VARCHAR(10),
        public_access_level VARCHAR(20),
        citation TEXT ,
        source_date TIMESTAMP ,
        group_visibility TEXT ,
        data_abstract TEXT ,
        area_of_interest VARCHAR(20),
        metadata_date TIMESTAMP,
        data_quality TEXT,
        projection VARCHAR(20),
        scale VARCHAR(15),
        visibility BOOLEAN NOT NULL,
        is_published BOOLEAN NOT NULL,
        edit_mode BOOLEAN  NOT NULL DEFAULT true
      ); 


      CREATE TABLE IF NOT EXISTS requests (
        id SERIAL PRIMARY KEY,
        email VARCHAR(100),
        file_name  VARCHAR(100) NOT NULL,
        theme VARCHAR(155) NOT NULL,
        type VARCHAR(50) NOT NULL,
        fields JSONB,
       values JSONB,
       condition TEXT,
       query_condition TEXT, 
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        request_status varchar(20)
      ); 

      CREATE TABLE IF NOT EXISTS emailotp (
        sn SERIAL PRIMARY KEY,
        email  VARCHAR(100) NOT NULL,
        otp VARCHAR(10) NOT NULL,
        time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ); 

      CREATE TABLE IF NOT EXISTS verifiedemails (
        sn SERIAL PRIMARY KEY,
        email  VARCHAR(100) NOT NULL
      ); 

       CREATE TABLE IF NOT EXISTS  adminlogs (
        sn SERIAL PRIMARY KEY,
        email VARCHAR(100) NOT NULL,
        organization VARCHAR(100) ,
        full_name VARCHAR(100) ,
        action_type VARCHAR(20) NOT NULL,
        target VARCHAR(100) NOT NULL,
        details TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ); 

       CREATE TABLE IF NOT EXISTS  datareaderlogs (
        sn SERIAL PRIMARY KEY,
        email VARCHAR(100) NOT NULL,
        organization VARCHAR(100) ,
        full_name VARCHAR(100)  ,
        action_type VARCHAR(20) NOT NULL,
        target VARCHAR(100) NOT NULL,
        details TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ); 

       CREATE TABLE IF NOT EXISTS  viewerlogs (
        sn SERIAL PRIMARY KEY,
        email VARCHAR(100) NOT NULL,
        organization VARCHAR(100),
        full_name VARCHAR(100)  ,
        action_type VARCHAR(20) NOT NULL,
        target VARCHAR(100) NOT NULL,
        details TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ); 

    `);
    console.log('Tables created successfully.');
  } catch (error) {
    console.error('Error creating tables:', error);
  }
}

createTables();
