import express from "express";
import { pool } from "./db/db.js";

const app = express();

app.get("/events/high-risk", async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT *
      FROM events
      WHERE risk_level IN ('HIGH', 'CRITICAL')
      ORDER BY risk_score DESC, id DESC
      `
    );
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(3000, () => {
  console.log("API listening on :3000");
});