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

export async function getAvailableCarts(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT id, orders_count, is_available
       FROM cart
       WHERE is_available = 1
       ORDER BY id DESC`
    );

    res.json({
      message: "Available carts fetched successfully",
      carts: rows
    });
  } catch (err) {
    console.error("Get available carts error:", err);
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

// تغيير حالة السلة إلى 0 (غير متاحة)


export async function setCartUnavailable(req, res) {
  const { cartId } = req.params;

  if (!cartId || Number.isNaN(Number(cartId))) {
    return res.status(400).json({ error: "Valid cartId is required" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1) تأكيد وجود السلة وقفلها
    const [[cart]] = await conn.query(
      "SELECT id, orders_count, is_available FROM cart WHERE id = ? FOR UPDATE",
      [cartId]
    );
    if (!cart) {
      await conn.rollback();
      return res.status(404).json({ error: "Cart not found" });
    }

    const wasAvailable = cart.is_available === 1;

    // 2) تعطيل السلة (حتى لو كانت معطلة من قبل لا مشكلة)
    await conn.query(
      "UPDATE cart SET is_available = 0 WHERE id = ?",
      [cartId]
    );

    // 3) ترقية الطلبات التابعة للسلة إلى position_id = 3
    //    بشرط: invoice_id IS NOT NULL AND invoice_id <> 0
    //           AND purchase_method IS NOT NULL AND purchase_method <> ''
    const [orderUpdate] = await conn.query(
      `UPDATE orders
          SET position_id = 3
        WHERE cart_id = ?
          AND (invoice_id IS NOT NULL AND invoice_id <> 0)
          AND (purchase_method IS NOT NULL AND purchase_method <> '')
          AND position_id <> 3`,
      [cartId]
    );

    // 4) إحضار حالة السلة بعد التحديث
    const [[updatedCart]] = await conn.query(
      "SELECT id, orders_count, is_available FROM cart WHERE id = ?",
      [cartId]
    );

    await conn.commit();

    return res.json({
      message: wasAvailable
        ? "Cart set to unavailable; eligible orders moved to position 3"
        : "Cart was already unavailable; eligible orders moved to position 3",
      cart: updatedCart,
      moved_orders_count: orderUpdate.affectedRows
    });
  } catch (err) {
    await conn.rollback();
    console.error("Set cart unavailable error:", err);
    return res.status(500).json({ error: "Internal server error" });
  } finally {
    conn.release();
  }
}



export async function getUnavailableCarts(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT id, orders_count, is_available
       FROM cart
       WHERE is_available = 0
       ORDER BY id DESC`
    );

    res.json({
      message: "Unavailable carts fetched successfully",
      carts: rows
    });
  } catch (err) {
    console.error("Get unavailable carts error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
