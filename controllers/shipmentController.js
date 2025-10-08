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

export const getReadyShipments = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        s.id,
        s.box_id,
        b.number          AS box_number,
        s.company_id,
        sc.company_name,
        s.sender_name,
        s.weight
      FROM shipments s
      LEFT JOIN box                b  ON s.box_id = b.id
      LEFT JOIN shipping_companies sc ON s.company_id = sc.id
      WHERE s.status_id = 1
      ORDER BY s.id DESC
    `);

    res.json({
      message: "Shipments (status=ready) fetched successfully",
      shipments: rows
    });
  } catch (err) {
    console.error("Get ready shipments error:", err);
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


export const getShippingShipments = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        s.id,
        s.box_id,
        b.number               AS box_number,
        s.company_id,
        sc.company_name,
        s.sender_name,
        s.weight,
        s.status_id,
        st.name                AS status_name
      FROM shipments s
      LEFT JOIN box                b  ON s.box_id     = b.id
      LEFT JOIN shipping_companies sc ON s.company_id = sc.id
      JOIN shipment_status         st ON s.status_id  = st.id
      WHERE s.status_id = 2
      ORDER BY s.id DESC
    `);

    res.json({
      message: "In-transit shipments (status=2) fetched successfully",
      shipments: rows
    });
  } catch (err) {
    console.error("Get in-transit shipments error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};



// POST /api/shipments/:shipmentId/arrive
export const markShipmentArrivedAndPromoteOrders = async (req, res) => {
  const { shipmentId } = req.params;
  if (!shipmentId || Number.isNaN(Number(shipmentId))) {
    return res.status(400).json({ error: "Valid shipmentId is required" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1) قفل الشحنة وجلب box_id والحالة الحالية
    const [[ship]] = await conn.query(
      `SELECT id, status_id, box_id
         FROM shipments
        WHERE id = ?
        FOR UPDATE`,
      [shipmentId]
    );
    if (!ship) {
      await conn.rollback();
      return res.status(404).json({ error: "Shipment not found" });
    }
    if (ship.status_id !== 2) {
      await conn.rollback();
      return res.status(400).json({ error: "Shipment is not in 'shipping' status (2)" });
    }

    // 2) تحديث حالة الشحنة إلى وصلت (3)
    await conn.query(
      `UPDATE shipments SET status_id = 3 WHERE id = ?`,
      [shipmentId]
    );

    // 3) لو عندها صندوق، حرّك كل الطلبات المرتبطة به إلى position_id = 5
    let moved = 0;
    if (ship.box_id != null) {
      const [upd] = await conn.query(
        `UPDATE orders
            SET position_id = 5
          WHERE box_id = ?
            AND position_id <> 5`,
        [ship.box_id]
      );
      moved = upd.affectedRows;
    }

    await conn.commit();

    return res.json({
      message: "Shipment marked as arrived and related orders moved to position 5",
      shipment: { id: Number(shipmentId), status_id: 3 },
      box_id: ship.box_id,                // قد تكون null
      moved_orders_count: moved
    });
  } catch (err) {
    await conn.rollback();
    console.error("markShipmentArrivedAndPromoteOrders error:", err);
    return res.status(500).json({ error: "Internal server error" });
  } finally {
    conn.release();
  }
};
