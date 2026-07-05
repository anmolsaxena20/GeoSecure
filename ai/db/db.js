import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Always load ai/.env even when command is run from ai/db.
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

try {
  const result = await pool.query("SELECT 1");
  console.log("✅ Database connected!");
  console.log(result.rows);
} catch (err) {
  console.error("❌ Database connection failed:", err);
}

export { pool };
