import pool from "../config/db.js";

// جلب شركات الشحن
export const getCompanies = async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM shipping_companies");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// اضافة شركة شحن
export const addCompany = async (req, res) => {
  const { company_name } = req.body;
  try {
    const [result] = await pool.query(
      "INSERT INTO shipping_companies (company_name) VALUES (?)",
      [company_name]
    );
    res.json({ id: result.insertId, company_name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
