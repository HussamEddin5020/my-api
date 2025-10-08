// controllers/orderCartController.js
import pool from "../config/db.js";

// ✅ 1) جلب Orders حسب cart_id + تحت الشراء
export async function getOrdersByCart(req, res) {
  const { cartId } = req.params;
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
       WHERE o.cart_id = ?`,
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




export async function removeOrderFromCart(req, res) {
  const { orderId } = req.params;
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // اقفل صف الطلب واحصل على cart_id الحالي
    const [[order]] = await conn.query(
      `SELECT id, cart_id, is_archived
       FROM orders
       WHERE id = ?
       FOR UPDATE`,
      [orderId]
    );

    if (!order) {
      await conn.rollback();
      return res.status(404).json({ error: "Order not found" });
    }

    const oldCartId = order.cart_id;

    // اجعل الطلب غير مؤرشف دائمًا، وامسح ربط السلة (حتى لو لم تكن مرتبطة)
    await conn.query(
      `UPDATE orders
         SET cart_id = NULL,
             is_archived = 0
       WHERE id = ?`,
      [orderId]
    );

    // لو كانت هناك سلة قديمة، أنقص عدّادها بشكل آمن (لا ينزل تحت الصفر)
    let decremented = false;
    if (oldCartId != null) {
      await conn.query(
        `UPDATE cart
            SET orders_count = CASE WHEN orders_count > 0 THEN orders_count - 1 ELSE 0 END
          WHERE id = ?`,
        [oldCartId]
      );
      decremented = true;
    }

    await conn.commit();

    return res.json({
      message:
        oldCartId != null
          ? `Order ${orderId} removed from cart ${oldCartId} and unarchived`
          : `Order ${orderId} unarchived (no cart to remove)`,
      order_id: Number(orderId),
      previous_cart_id: oldCartId,            // قد تكون null
      decremented_previous_cart: decremented, // true/false
      is_archived: 0
    });
  } catch (err) {
    await conn.rollback();
    console.error("Remove order from cart error:", err);
    return res.status(500).json({ error: "Internal server error" });
  } finally {
    conn.release();
  }
}



export async function getOrdersNotAssignedInCart(req, res) {
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
       WHERE o.cart_id IS NULL
         AND o.position_id = 2`
    );

    res.json({
      message: "Orders (not assigned in cart) fetched successfully",
      orders: rows
    });
  } catch (err) {
    console.error("Get orders not assigned in cart error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

