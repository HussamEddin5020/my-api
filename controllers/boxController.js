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

