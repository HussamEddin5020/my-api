// controllers/cartController.js
import pool from "../config/db.js";


export async function createCart(req, res) {
  try {
    const [result] = await pool.query(
      `INSERT INTO cart (orders_count) VALUES (0)`
    );

    res.status(201).json({
      message: "Cart created successfully",
      cart: {
        id: result.insertId,
        orders_count: 0
      }
    });
  } catch (err) {
    console.error("Create cart error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ✅ جلب كل السلات
export async function getAllCarts(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT id, orders_count FROM cart ORDER BY id`
    );
    res.json({
      message: "Carts fetched successfully",
      carts: rows,
    });
  } catch (err) {
    console.error("Get carts error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ✅ زيادة orders_count لسلة محددة
export async function incrementCart(req, res) {
  const { id } = req.params;
  try {
    const [result] = await pool.query(
      `UPDATE cart SET orders_count = orders_count + 1 WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Cart not found" });
    }

    res.json({ message: `Cart ${id} incremented successfully` });
  } catch (err) {
    console.error("Increment cart error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
