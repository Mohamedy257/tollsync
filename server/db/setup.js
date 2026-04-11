require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const schema = `
  CREATE TABLE IF NOT EXISTS hosts (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS vehicles (
    id SERIAL PRIMARY KEY,
    host_id INTEGER REFERENCES hosts(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    plate VARCHAR(50) NOT NULL,
    transponder_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS trips (
    id SERIAL PRIMARY KEY,
    host_id INTEGER REFERENCES hosts(id) ON DELETE CASCADE,
    renter_name VARCHAR(255),
    vehicle VARCHAR(255),
    vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
    start_datetime TIMESTAMP NOT NULL,
    end_datetime TIMESTAMP NOT NULL,
    trip_id VARCHAR(100),
    source_file VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS toll_transactions (
    id SERIAL PRIMARY KEY,
    host_id INTEGER REFERENCES hosts(id) ON DELETE CASCADE,
    transponder_id VARCHAR(100),
    entry_datetime TIMESTAMP,
    exit_datetime TIMESTAMP,
    match_datetime TIMESTAMP NOT NULL,
    location VARCHAR(255),
    amount NUMERIC(10,2) NOT NULL,
    source_file VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS trip_results (
    id SERIAL PRIMARY KEY,
    host_id INTEGER REFERENCES hosts(id) ON DELETE CASCADE,
    trip_id INTEGER REFERENCES trips(id) ON DELETE CASCADE,
    toll_transaction_id INTEGER REFERENCES toll_transactions(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  );
`;

async function setup() {
  try {
    await pool.query(schema);
    console.log('✅ Database schema created successfully');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error creating schema:', err.message);
    process.exit(1);
  }
}

setup();
