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

    // 1) قفل السلة
    const [[cart]] = await conn.query(
      `SELECT id, orders_count, is_available
         FROM cart
        WHERE id = ?
        FOR UPDATE`,
      [cartId]
    );
    if (!cart) {
      await conn.rollback();
      return res.status(404).json({ error: "Cart not found" });
    }

    // 2) قفل الطلبات المعنية (position_id = 2) وجلبها للتحقق
    const [orders] = await conn.query(
      `SELECT id, invoice_id, purchase_method, is_archived
         FROM orders
        WHERE cart_id = ?
          AND position_id = 2
        FOR UPDATE`,
      [cartId]
    );

    // لو ما فيه طلبات في الحالة 2، نسمح بالإغلاق مباشرة (حسب رغبتك)
    // لو تبغى تمنع الإغلاق إذا ما فيه طلبات، بدّل الشرط حسب حاجتك.
    if (orders.length === 0) {
      // أغلق السلة فقط
      await conn.query(`UPDATE cart SET is_available = 0 WHERE id = ?`, [cartId]);

      await conn.commit();
      return res.json({
        message: "Cart set to unavailable (no pos=2 orders to move)",
        cart: { id: Number(cartId), orders_count: cart.orders_count, is_available: 0 },
        moved_orders_count: 0,
        unarchived_orders_count: 0
      });
    }

    // 3) تحقق أن "كل" الطلبات مستوفية للشروط
    const invalid = orders.filter(
      (o) =>
        o.invoice_id == null ||
        Number(o.invoice_id) === 0 ||
        o.purchase_method == null ||
        String(o.purchase_method).trim() === ""
    );

    if (invalid.length > 0) {
      // فشل التحقق ⇒ إلغاء العملية كاملة
      await conn.rollback();
      return res.status(400).json({
        error:
          "Cannot close cart: not all orders meet the requirements (invoice + purchase_method).",
        cart_id: Number(cartId),
        invalid_order_ids: invalid.map((o) => o.id) // لمساعدتك في الواجهة
      });
    }

    // 4) كل الطلبات مستوفية ⇒ صفّر الأرشفة للطلبات المعنية فقط
    const [unarchiveUpd] = await conn.query(
      `UPDATE orders
          SET is_archived = 0
        WHERE cart_id = ?
          AND position_id = 2
          AND is_archived = 1`,
      [cartId]
    );

    // 5) حوّل الطلبات من 2 → 3
    const [moveUpd] = await conn.query(
      `UPDATE orders
          SET position_id = 3
        WHERE cart_id = ?
          AND position_id = 2`,
      [cartId]
    );

    // 6) أغلق السلة بعد نجاح نقل الطلبات وتصفير أرشفتها
    await conn.query(`UPDATE cart SET is_available = 0 WHERE id = ?`, [cartId]);

    await conn.commit();

    return res.json({
      message:
        "All orders validated; orders moved from position 2 to 3; cart set to unavailable.",
      cart: { id: Number(cartId), orders_count: cart.orders_count, is_available: 0 },
      moved_orders_count: moveUpd.affectedRows,
      unarchived_orders_count: unarchiveUpd.affectedRows
    });
  } catch (err) {
    await conn.rollback();
    console.error("setCartUnavailable strict error:", err);
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
