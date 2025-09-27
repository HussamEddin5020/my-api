import pool from "../config/db.js";

// جلب كل الصناديق
export const getBoxes = async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM box");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// اضافة صندوق
export const addBox = async (req, res) => {
  const { number, name } = req.body;
  try {
    const [result] = await pool.query(
      "INSERT INTO box (number, name) VALUES (?, ?)",
      [number, name]
    );
    res.json({ id: result.insertId, number, name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
