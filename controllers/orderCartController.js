// controllers/orderCartController.js
import pool from "../config/db.js";

// ✅ 1) جلب Orders حسب cart_id + تحت الشراء
export async function getOrdersByCart(req, res) {
  const { cartId } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT o.id, o.customer_id, o.creator_user_id, o.creator_customer_id,
              o.collection_id, o.position_id, o.created_at
       FROM orders o
       WHERE o.cart_id = ? AND o.position_id = 2`,
      [cartId]
    );

    res.json({
      message: "Orders fetched successfully",
      orders: rows
    });
  } catch (err) {
    console.error("Get orders by cart error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ✅ 2) إضافة Order إلى سلة
export async function addOrderToCart(req, res) {
  const { order_id, cart_id } = req.body;
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // اربط الاوردر بالسلة
    const [result] = await conn.query(
      `UPDATE orders SET cart_id = ? WHERE id = ?`,
      [cart_id, order_id]
    );

    if (result.affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({ error: "Order not found" });
    }

    // زد العداد
    await conn.query(
      `UPDATE cart SET orders_count = orders_count + 1 WHERE id = ?`,
      [cart_id]
    );

    await conn.commit();
    res.json({ message: `Order ${order_id} added to cart ${cart_id}` });
  } catch (err) {
    await conn.rollback();
    console.error("Add order to cart error:", err);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    conn.release();
  }
}

// ✅ 3) إزالة Order من السلة
export async function removeOrderFromCart(req, res) {
  const { orderId } = req.params;
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // جيب cart_id الحالي
    const [rows] = await conn.query(
      `SELECT cart_id FROM orders WHERE id = ?`,
      [orderId]
    );

    if (rows.length === 0 || !rows[0].cart_id) {
      await conn.rollback();
      return res.status(404).json({ error: "Order not linked to any cart" });
    }

    const cartId = rows[0].cart_id;

    // امسح الربط
    await conn.query(`UPDATE orders SET cart_id = NULL WHERE id = ?`, [orderId]);

    // انقص العداد
    await conn.query(
      `UPDATE cart SET orders_count = orders_count - 1 WHERE id = ? AND orders_count > 0`,
      [cartId]
    );

    await conn.commit();
    res.json({ message: `Order ${orderId} removed from cart ${cartId}` });
  } catch (err) {
    await conn.rollback();
    console.error("Remove order from cart error:", err);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    conn.release();
  }
}
