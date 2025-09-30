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



export const updateShipment = async (req, res) => {
  const { id } = req.params;
  const { box_id, company_id, sender_name, weight, images, image_data } = req.body;

  const conn = await pool.getConnection();
  try {
    // تأكد أن الشحنة موجودة
    const [exists] = await conn.query("SELECT id FROM shipments WHERE id = ?", [id]);
    if (exists.length === 0) {
      conn.release();
      return res.status(404).json({ error: "Shipment not found" });
    }

    await conn.beginTransaction();

    // 1) تحديث حقول الشحنة (فقط المرسلة)
    const sets = [];
    const vals = [];

    if (box_id !== undefined) {
      sets.push("box_id = ?");
      vals.push(box_id); // يقبل null أيضًا لو تريد تفريغه
    }

    if (company_id !== undefined) {
      sets.push("company_id = ?");
      vals.push(company_id);
    }

    if (sender_name !== undefined) {
      if (String(sender_name).trim() === "") {
        await conn.rollback();
        conn.release();
        return res.status(400).json({ error: "sender_name cannot be empty" });
      }
      sets.push("sender_name = ?");
      vals.push(sender_name);
    }

    if (weight !== undefined) {
      const w = Number(weight);
      if (Number.isNaN(w)) {
        await conn.rollback();
        conn.release();
        return res.status(400).json({ error: "weight must be a number" });
      }
      sets.push("weight = ?");
      vals.push(w);
    }

    if (sets.length > 0) {
      await conn.query(`UPDATE shipments SET ${sets.join(", ")} WHERE id = ?`, [
        ...vals,
        id,
      ]);
    }

    // 2) الصور (اختياري)
    const imagesProvided = images !== undefined || image_data !== undefined;
    if (imagesProvided) {
      // امسح الصور القديمة
      await conn.query(`DELETE FROM shipment_images WHERE shipment_id = ?`, [id]);

      // جهّز الصور الجديدة
      let newImages = [];
      if (Array.isArray(images)) {
        newImages = images.filter((s) => typeof s === "string" && s.length > 0);
      } else if (typeof image_data === "string" && image_data.length > 0) {
        newImages = [image_data];
      }

      // أدخل الصور الجديدة (إن وجدت)
      if (newImages.length > 0) {
        const values = newImages.map(() => "(?, ?)").join(",");
        const params = newImages.flatMap((img) => [id, img]);
        await conn.query(
          `INSERT INTO shipment_images (shipment_id, image_data) VALUES ${values}`,
          params
        );
      }
      // لو أرسلت images: [] → يبقى بدون صور (تم الحذف فقط)
    }

    await conn.commit();

    // 3) رجّع الشحنة المحدثة مع الصور
    const [[shipment]] = await conn.query(
      `SELECT
         s.id,
         s.box_id,
         b.number AS box_number,
         s.company_id,
         sc.company_name,
         s.sender_name,
         s.weight
       FROM shipments s
       LEFT JOIN box b                 ON s.box_id = b.id
       LEFT JOIN shipping_companies sc ON s.company_id = sc.id
       WHERE s.id = ?`,
      [id]
    );

    const [imgs] = await conn.query(
      `SELECT id, image_data FROM shipment_images WHERE shipment_id = ? ORDER BY id`,
      [id]
    );

    conn.release();
    return res.json({
      message: "Shipment updated successfully",
      shipment,
      images: imgs,
    });
  } catch (err) {
    try { await conn.rollback(); } catch {}
    conn.release();
    console.error("Update shipment (dynamic) error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};