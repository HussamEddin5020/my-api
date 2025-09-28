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

// ربط Order بصندوق (إضافة order إلى box)
export async function assignOrderToBox(req, res) {
  const { orderId, boxId } = req.body;

  if (!orderId || !boxId) {
    return res.status(400).json({ error: "orderId and boxId are required" });
  }

  try {
    await pool.query(
      "UPDATE orders SET box_id = ? WHERE id = ?",
      [boxId, orderId]
    );

    res.json({
      message: `Order ${orderId} assigned to Box ${boxId} successfully`
    });
  } catch (err) {
    console.error("Assign order to box error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// إزالة Order من صندوق (فك الارتباط)
export async function removeOrderFromBox(req, res) {
  const { orderId } = req.body;

  if (!orderId) {
    return res.status(400).json({ error: "orderId is required" });
  }

  try {
    await pool.query(
      "UPDATE orders SET box_id = NULL WHERE id = ?",
      [orderId]
    );

    res.json({
      message: `Order ${orderId} removed from Box successfully`
    });
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
