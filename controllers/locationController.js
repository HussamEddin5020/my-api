import pool from "../config/db.js";

// 🔹 جلب كل المدن
export async function getCities(req, res) {
  try {
    const [rows] = await pool.query(`SELECT id, name FROM cities`);
    res.json(rows);
  } catch (err) {
    console.error("Error fetching cities:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// 🔹 جلب المناطق حسب المدينة
export async function getAreasByCity(req, res) {
  const { cityId } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT id, name FROM areas WHERE city_id = ?`,
      [cityId]
    );
    res.json(rows);
  } catch (err) {
    console.error("Error fetching areas:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
