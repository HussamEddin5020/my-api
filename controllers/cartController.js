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
      `SELECT * FROM cart ORDER BY id`
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



// GET /api/carts/:cartId/orders  → جلب الطلبات بحسب Cart ID
export async function getOrdersByCartId(req, res) {
  const { cartId } = req.params;

  if (!cartId || Number.isNaN(Number(cartId))) {
    return res.status(400).json({ error: "Valid cartId is required" });
  }

  try {
    const [rows] = await pool.query(
      `SELECT 
          o.id AS order_id,
          o.customer_id,
          u.name AS customer_name,
          o.creator_user_id,
          o.creator_customer_id,
          o.collection_id,
          o.position_id,
          o.box_id,
          o.barcode,
          o.created_at
       FROM orders o
       JOIN customers c ON o.customer_id = c.id
       JOIN users u     ON c.user_id     = u.id
       WHERE o.cart_id = ?
       ORDER BY o.created_at DESC`,
      [cartId]
    );

    res.json({
      message: "Orders by cart fetched successfully",
      orders: rows
    });
  } catch (err) {
    console.error("Get orders by cart error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
