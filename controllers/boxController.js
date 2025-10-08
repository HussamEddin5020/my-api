import pool from "../config/db.js";

// إضافة صندوق جديد
export async function addBox(req, res) {
  const { number } = req.body;

  if (!number) {
    return res.status(400).json({ error: "Box number is required" });
  }

  try {
    const [result] = await pool.query(
      "INSERT INTO box (number) VALUES (?)",
      [number]
    );

    res.json({
      message: "Box added successfully",
      box: { id: result.insertId, number }
    });
  } catch (err) {
    console.error("Add box error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ربط Order بصندوق
export async function assignOrderToBox(req, res) {
  const { orderId, boxId } = req.body;

  if (!orderId || !boxId) {
    return res.status(400).json({ error: "orderId and boxId are required" });
  }

  try {
    await pool.query("UPDATE orders SET box_id = ? WHERE id = ?", [boxId, orderId]);

    // تحديث عدد الطلبات في البوكس
    await pool.query(
      "UPDATE box SET orders_count = orders_count + 1 WHERE id = ?",
      [boxId]
    );

    res.json({ message: `Order ${orderId} assigned to Box ${boxId} successfully` });
  } catch (err) {
    console.error("Assign order to box error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// إزالة Order من صندوق
export async function removeOrderFromBox(req, res) {
  const { orderId } = req.body;

  if (!orderId) {
    return res.status(400).json({ error: "orderId is required" });
  }

  try {
    // نجيب الـ box_id المرتبط بالأوردر أولاً
    const [rows] = await pool.query("SELECT box_id FROM orders WHERE id = ?", [orderId]);

    if (rows.length === 0 || !rows[0].box_id) {
      return res.status(404).json({ error: "Order not assigned to any box" });
    }

    const boxId = rows[0].box_id;

    // إزالة الربط
    await pool.query("UPDATE orders SET box_id = NULL WHERE id = ?", [orderId]);

    // تحديث العدد
    await pool.query(
      "UPDATE box SET orders_count = orders_count - 1 WHERE id = ? AND orders_count > 0",
      [boxId]
    );

    res.json({ message: `Order ${orderId} removed from Box ${boxId} successfully` });
  } catch (err) {
    console.error("Remove order from box error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}


// عرض جميع الصناديق
export async function getAllBoxes(req, res) {
  try {
    const [rows] = await pool.query("SELECT * FROM box");
    res.json({
      message: "Boxes fetched successfully",
      boxes: rows
    });
  } catch (err) {
    console.error("Get boxes error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getOrdersByBox(req, res) {
  const { boxId } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT o.id,
              o.customer_id,
              u.name AS customer_name,
              o.creator_user_id,
              o.creator_customer_id,
              o.collection_id,
              o.position_id,
              o.created_at
       FROM orders o
       JOIN customers c ON o.customer_id = c.id
       JOIN users u ON c.user_id = u.id
       WHERE o.box_id = ? AND o.position_id = 3`,
      [boxId]
    );

    res.json({
      message: "Orders fetched successfully",
      orders: rows
    });
  } catch (err) {
    console.error("Get orders by box error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}


export async function getOrdersNotAssignedInBox(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT o.id,
              o.customer_id,
              u.name AS customer_name,
              o.creator_user_id,
              o.creator_customer_id,
              o.collection_id,
              o.position_id,
              o.created_at
       FROM orders o
       JOIN customers c ON o.customer_id = c.id
       JOIN users u ON c.user_id = u.id
       WHERE o.box_id IS NULL
         AND o.position_id = 3`
    );

    res.json({
      message: "Orders (not assigned in box) fetched successfully",
      orders: rows
    });
  } catch (err) {
    console.error("Get orders not assigned in box error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}



export async function getUnavailableBoxes(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT id, number, orders_count, is_available
       FROM box
       WHERE is_available = 0
       ORDER BY id DESC`
    );

    res.json({
      message: "Unavailable boxes fetched successfully",
      boxes: rows
    });
  } catch (err) {
    console.error("Get unavailable boxes error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}


export async function getAvailableBoxes(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT id, number, orders_count, is_available
       FROM box
       WHERE is_available = 1
       ORDER BY id DESC`
    );

    res.json({
      message: "Available boxes fetched successfully",
      boxes: rows
    });
  } catch (err) {
    console.error("Get available boxes error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}




/**
 * POST /api/boxes/:boxId/move-to-shipping
 *
 * الوظائف:
 * 1) ضبط الصندوق is_available = 0
 * 2) تحويل جميع الطلبات المرتبطة بالصندوق (box_id = :boxId) من position_id=3 إلى position_id=4
 * 3) نقل حالة الشحنات التابعة للصندوق (shipments.box_id = :boxId) إلى status_id = 2 (جاري الشحن)
 *
 * ملاحظة: نحدّث الشحنات فقط إن كانت حالتها "جاهزة للشحن" (status_id = 1)
 * لتفادي إنزال شحنات وصلت (3) أو جارية (2) للخلف.
 * لو تحب نجبر التعيين إلى 2 لأي حالة، أخبرني أزيل شرط =1.
 */
export async function moveBoxToShipping(req, res) {
  const { boxId } = req.params;
  if (!boxId || Number.isNaN(Number(boxId))) {
    return res.status(400).json({ error: "Valid boxId is required" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1) تأكيد وجود الصندوق وقفل صفّه
    const [[box]] = await conn.query(
      `SELECT id, is_available FROM box WHERE id = ? FOR UPDATE`,
      [boxId]
    );
    if (!box) {
      await conn.rollback();
      return res.status(404).json({ error: "Box not found" });
    }

    // 2) اجعل الصندوق غير متاح دائمًا
    await conn.query(
      `UPDATE box SET is_available = 0 WHERE id = ?`,
      [boxId]
    );

    // 3) حرّك الطلبات من 3 → 4 (الخاصة بهذا الصندوق)
    const [ordersUpd] = await conn.query(
      `UPDATE orders
          SET position_id = 4
        WHERE box_id = ?
          AND position_id = 3`,
      [boxId]
    );

    // 4) انقل حالة الشحنات الخاصة بالصندوق إلى "جاري الشحن" (2)
    //    هنا نحدّث فقط الشحنات الجاهزة للشحن (1) لتفادي الرجوع للخلف.
    const [shipUpd] = await conn.query(
      `UPDATE shipments
          SET status_id = 2
        WHERE box_id = ?
          AND status_id = 1`,
      [boxId]
    );

    await conn.commit();

    return res.json({
      message: "Box set unavailable, orders moved 3→4, shipments moved to 'shipping' (2)",
      box: { id: Number(boxId), is_available: 0 },
      moved_orders_count: ordersUpd.affectedRows,
      moved_shipments_count: shipUpd.affectedRows
    });
  } catch (err) {
    await conn.rollback();
    console.error("moveBoxToShipping error:", err);
    return res.status(500).json({ error: "Internal server error" });
  } finally {
    conn.release();
  }
}
