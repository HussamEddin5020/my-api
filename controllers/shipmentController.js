import pool from "../config/db.js";

/**
 * ➕ إضافة شحنة جديدة
 * body: { box_id, company_id, sender_name, weight, images (اختياري) }
 */
export const addShipment = async (req, res) => {
  const { box_id, company_id, sender_name, weight, images } = req.body;

  if (!box_id || !company_id || !sender_name || !weight) {
    return res.status(400).json({
      error: "box_id, company_id, sender_name, and weight are required"
    });
  }

  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    // ➊ إدخال الشحنة
    const [shipmentResult] = await conn.query(
      `INSERT INTO shipments (box_id, company_id, sender_name, weight)
       VALUES (?, ?, ?, ?)`,
      [box_id, company_id, sender_name, weight]
    );

    const shipmentId = shipmentResult.insertId;

    // ➋ إدخال الصور (إذا موجودة)
    if (images && Array.isArray(images)) {
      for (const img of images) {
        await conn.query(
          `INSERT INTO shipment_images (shipment_id, image_data)
           VALUES (?, ?)`,
          [shipmentId, img]
        );
      }
    }

    await conn.commit();

    res.json({
      message: "Shipment added successfully",
      shipment: {
        id: shipmentId,
        box_id,
        company_id,
        sender_name,
        weight,
        images: images || []
      }
    });
  } catch (err) {
    await conn.rollback();
    console.error("Add shipment error:", err);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    conn.release();
  }
};

/**
 * ➕ إضافة صورة لشحنة موجودة
 * body: { shipment_id, image_data }
 */
export const addShipmentImage = async (req, res) => {
  const { shipment_id, image_data } = req.body;

  if (!shipment_id || !image_data) {
    return res.status(400).json({
      error: "shipment_id and image_data are required"
    });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO shipment_images (shipment_id, image_data)
       VALUES (?, ?)`,
      [shipment_id, image_data]
    );

    res.json({
      message: "Image added to shipment successfully",
      image: {
        id: result.insertId,
        shipment_id
      }
    });
  } catch (err) {
    console.error("Add shipment image error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};


export const getShipments = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        s.id,
        s.box_id,
        b.number        AS box_number,
        s.company_id,
        sc.company_name,
        s.sender_name,
        s.weight
      FROM shipments s
      LEFT JOIN box b                ON s.box_id = b.id
      LEFT JOIN shipping_companies sc ON s.company_id = sc.id
      ORDER BY s.id DESC
    `);

    res.json({
      message: "Shipments fetched successfully",
      shipments: rows
    });
  } catch (err) {
    console.error("Get shipments error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};
