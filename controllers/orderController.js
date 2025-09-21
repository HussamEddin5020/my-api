// controllers/orderController.js
import pool from "../config/db.js";
import {
  createOrder,
  deleteOrder,
  insertOrderDetails,
  getFullOrderById,
} from "../queries/orderQueries.js";

// ✅ helper لتسجيل أي نشاط
async function logOrderActivity({
  orderId,
  orderDetailId = null,
  actionType,
  fieldName = null,
  oldValue = null,
  newValue = null,
  actorId,
  actorType
}) {
  await pool.query(
    `INSERT INTO order_activity_log 
     (order_id, order_detail_id, action_type, field_name, old_value, new_value, actor_id, actor_type)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [orderId, orderDetailId, actionType, fieldName, oldValue, newValue, actorId, actorType]
  );
}

// إنشاء طلب
export async function createNewOrder(req, res) {
  const { creator_user_id, creator_customer_id, customer_id, collection_id, position_id } = req.body;
  try {
    const [result] = await pool.query(createOrder, [
      creator_user_id || null,
      creator_customer_id || null,
      customer_id,
      collection_id || null,
      position_id,
    ]);

    // ✅ سجل النشاط
    await logOrderActivity({
      orderId: result.insertId,
      actionType: "CREATE",
      actorId: creator_user_id || creator_customer_id,
      actorType: creator_user_id ? "user" : "customer",
      newValue: JSON.stringify({ position_id })
    });

    res.status(201).json({ message: "Order created", orderId: result.insertId });
  } catch (err) {
    console.error("Create order error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}


export async function getOrdersCountByPosition(req, res) {
  try {
    const [rows] = await pool.query(`
  SELECT 
  p.id AS position_id,
  p.name AS position_name,
  COUNT(o.id) AS total_orders
FROM order_position p
LEFT JOIN orders o ON o.position_id = p.id
GROUP BY p.id, p.name
ORDER BY p.id;

`);

    res.json({
      message: "Orders grouped by position",
      stats: rows
    });
  } catch (err) {
    console.error("Get orders count by position error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// حذف طلب
export async function deleteOrderById(req, res) {
  const { id } = req.params;
  const { actor_id, actor_type } = req.body;
  try {
    await pool.query(deleteOrder, [id]);

    // ✅ سجل النشاط
    await logOrderActivity({
      orderId: id,
      actionType: "DELETE",
      actorId: actor_id,
      actorType: actor_type || "user"
    });

    res.json({ message: "Order deleted successfully" });
  } catch (err) {
    console.error("Delete order error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}


export async function getOrdersCountByMonth(req, res) {
  try {
    const [rows] = await pool.query(`
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m') AS month,
        COUNT(*) AS total_orders
      FROM orders
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY month
    `);

    res.json({
      message: "Orders count per month",
      stats: rows
    });
  } catch (err) {
    console.error("Get orders count by month error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// إنشاء طلب كامل
export async function createFullOrder(req, res) {
  const { creator_user_id, creator_customer_id, customer_id, collection_id, position_id, details } = req.body;

  if ((creator_user_id && creator_customer_id) || (!creator_user_id && !creator_customer_id)) {
    return res.status(400).json({
      error: "Order must be created by either a user OR a customer, not both"
    });
  }

  if (creator_user_id && !customer_id) {
    return res.status(400).json({
      error: "When a user creates an order, customer_id must be provided"
    });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [orderResult] = await conn.query(createOrder, [
      creator_user_id || null,
      creator_customer_id || null,
      customer_id || null,
      collection_id || null,
      position_id
    ]);
    const orderId = orderResult.insertId;

    if (details && details.length > 0) {
      const values = details.map(d => [
        orderId,
        d.image_url || null,
        d.title,
        d.description || null,
        d.notes || null,
        d.color || null,
        d.size || null,
        d.capacity || null,
        d.prepaid_value || 0,
        d.original_product_price || 0,
        d.commission || 0,
        d.total || 0
      ]);
      await conn.query(insertOrderDetails, [values]);
    }

    // ✅ سجل النشاط
    await logOrderActivity({
      orderId,
      actionType: "CREATE",
      actorId: creator_user_id || creator_customer_id,
      actorType: creator_user_id ? "user" : "customer",
      newValue: JSON.stringify({ position_id, details })
    });

    await conn.commit();
    res.status(201).json({ message: "Full order created successfully", orderId });
  } catch (err) {
    await conn.rollback();
    console.error("Create full order error:", err);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    conn.release();
  }
}


// جلب طلب كامل + النشاطات
export async function getFullOrder(req, res) {
  const { id } = req.params;

  try {
    // 1) الطلب + تفاصيل المنتجات
    const [rows] = await pool.query(getFullOrderById, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    // نظم البيانات
    const order = {
      order_id: rows[0].order_id,
      created_at: rows[0].order_created,
      updated_at: rows[0].order_updated,
      collection_id: rows[0].collection_id,
      customer: {
        customer_id: rows[0].customer_id,
        user_id: rows[0].customer_user_id,
        name: rows[0].customer_name,
        email: rows[0].customer_email,
        phone: rows[0].customer_phone
      },
      current_status: rows[0].current_status,
      details: rows.map(r => ({
        detail_id: r.detail_id,
        image_url: r.image_url,
        title: r.title,
        description: r.description,
        notes: r.notes,
        color: r.color,
        size: r.size,
        capacity: r.capacity,
        prepaid_value: r.prepaid_value,
        original_product_price: r.original_product_price,
        commission: r.commission,
        total: r.total
      }))
    };

    // 2) النشاطات بدل history
    const [activityRows] = await pool.query(
      `SELECT * FROM order_activity_log WHERE order_id = ? ORDER BY changed_at DESC`,
      [id]
    );

    order.activities = activityRows;

    res.json(order);
  } catch (err) {
    console.error("Get full order error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}


// ✅ Unified update for orders + details
export async function updateOrderUnified(req, res) {
  const { id } = req.params;
  const { ...updates } = req.body;
    const actor_id = req.user.id;
    const actor_type = req.user.type;


  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1) Get old order
    const [orderRows] = await conn.query("SELECT * FROM orders WHERE id = ?", [id]);
    if (orderRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: "Order not found" });
    }
    const oldOrder = orderRows[0];

    // 2) Get details
    const [detailsRows] = await conn.query("SELECT * FROM order_details WHERE order_id = ?", [id]);
    const oldDetails = detailsRows;

    // Define which fields belong where
    const orderFields = ["position_id", "collection_id"];
    const detailFields = [
      "title",
      "description",
      "notes",
      "color",
      "size",
      "capacity",
      "prepaid_value",
      "original_product_price",
      "commission",
      "total",
      "image_url"
    ];

    // 3) Update order header
    for (let field of orderFields) {
      if (updates[field] !== undefined && updates[field] != oldOrder[field]) {
        await conn.query(`UPDATE orders SET ${field} = ? WHERE id = ?`, [updates[field], id]);

        await conn.query(
          `INSERT INTO order_activity_log 
           (order_id, order_detail_id, action_type, field_name, old_value, new_value, actor_id, actor_type)
           VALUES (?, NULL, 'UPDATE', ?, ?, ?, ?, ?)`,
          [id, field, oldOrder[field], updates[field], actor_id, actor_type || "user"]
        );
      }
    }

    // 4) Update details
    for (let detail of oldDetails) {
      for (let field of detailFields) {
        if (updates[field] !== undefined && updates[field] != detail[field]) {
          await conn.query(
            `UPDATE order_details SET ${field} = ? WHERE id = ?`,
            [updates[field], detail.id]
          );

          await conn.query(
            `INSERT INTO order_activity_log 
             (order_id, order_detail_id, action_type, field_name, old_value, new_value, actor_id, actor_type)
             VALUES (?, ?, 'UPDATE', ?, ?, ?, ?, ?)`,
            [id, detail.id, field, detail[field], updates[field], actor_id, actor_type || "user"]
          );
        }
      }
    }

    await conn.commit();
    res.json({ message: "Order updated successfully" });

  } catch (err) {
    await conn.rollback();
    console.error("Unified order update error:", err);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    conn.release();
  }
}

