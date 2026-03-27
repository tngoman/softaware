const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
dotenv.config();

async function run() {
  const match = process.env.DATABASE_URL.match(/^mysql:\/\/([^:]+):?([^@]*)@([^:]+):(\d+)\/(.+)$/);
  const pool = mysql.createPool({host: match[3], port: parseInt(match[4], 10), user: match[1], password: match[2], database: match[5]});
  
  try {
    await pool.query('ALTER TABLE update_software ADD COLUMN linked_codebase VARCHAR(1000) NULL;');
    console.log('Added linked_codebase');
  } catch (e) { console.log(e.message); }
  
  try {
    await pool.query('ALTER TABLE users ADD COLUMN ai_developer_tools_granted TINYINT(1) NOT NULL DEFAULT 0;');
    console.log('Added ai_developer_tools_granted');
  } catch (e) { console.log(e.message); }
  
  process.exit(0);
}
run();
