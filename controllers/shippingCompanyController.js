import pool from "../config/db.js";

// ➕ إضافة شركة شحن جديدة

// 📋 جلب جميع شركات الشحن
// ➕ إضافة شركة شحن جديدة
export async function addShippingCompany(req, res) {
  const { company_name } = req.body;

  if (!company_name) {
    return res.status(400).json({ error: "Company name is required" });
  }

  try {
    const [result] = await pool.query(
      "INSERT INTO shipping_companies (company_name) VALUES (?)",
      [company_name]
    );

    res.json({
      message: "Shipping company added successfully",
      company: { id: result.insertId, company_name }
    });
  } catch (err) {
    console.error("Add shipping company error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// 📋 جلب جميع شركات الشحن
export async function getShippingCompanies(req, res) {
  try {
    const [rows] = await pool.query("SELECT id, company_name FROM shipping_companies");

    res.json({
      message: "Shipping companies fetched successfully",
      companies: rows
    });
  } catch (err) {
    console.error("Get shipping companies error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

