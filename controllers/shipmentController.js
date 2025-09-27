import pool from "../config/db.js";

// جلب كل الشحنات
export const getShipments = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT s.id, s.weight, b.name AS box_name, sc.company_name
      FROM shipments s
      JOIN box b ON s.box_id = b.id
      JOIN shipping_companies sc ON s.company_id = sc.id
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// اضافة شحنة جديدة
export const addShipment = async (req, res) => {
  const { box_id, company_id, weight } = req.body;
  try {
    const [result] = await pool.query(
      "INSERT INTO shipments (box_id, company_id, weight) VALUES (?, ?, ?)",
      [box_id, company_id, weight]
    );
    res.json({ id: result.insertId, box_id, company_id, weight });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// اضافة صورة للشحنة
export const addShipmentImage = async (req, res) => {
  const { shipment_id, image_data } = req.body;
  try {
    const [result] = await pool.query(
      "INSERT INTO shipment_images (shipment_id, image_data) VALUES (?, ?)",
      [shipment_id, image_data]
    );
    res.json({ id: result.insertId, shipment_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
