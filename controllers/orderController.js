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
        DAY(created_at) AS day,
        COUNT(*) AS total_orders
      FROM orders
      GROUP BY DATE_FORMAT(created_at, '%Y-%m'), DAY(created_at)
      ORDER BY month, day
    `);

    // إعادة ترتيب النتائج في JSON متداخل
    const stats = {};
    rows.forEach(row => {
      if (!stats[row.month]) {
        stats[row.month] = {};
      }
      stats[row.month][row.day] = row.total_orders;
    });

    res.json({
      message: "Orders count per day in each month",
      stats
    });
  } catch (err) {
    console.error("Get orders count by day in month error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/*
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
*/
// إنشاء طلب كامل
// controllers/orderController.js


export async function createFullOrder(req, res) {
  const {
    customer_id,
    creator_user_id,
    creator_customer_id,
    collection_id,
    position_id,
    detail,     // الشكل الجديد
    details     // دعم خلفي: سنسمح به فقط إذا كان فيه عنصر واحد
  } = req.body;

  // السماح بمصدر واحد للتفاصيل:
  let resolvedDetail = detail;
  if (!resolvedDetail && Array.isArray(details)) {
    if (details.length === 1) {
      resolvedDetail = details[0];
    } else {
      return res.status(400).json({ error: "Order must have exactly one detail" });
    }
  }

  if (!resolvedDetail || typeof resolvedDetail !== "object") {
    return res.status(400).json({ error: "A single 'detail' object is required" });
  }

  // منطق من ينشئ الطلب: إما user أو customer (واحد فقط)
  if ((creator_user_id && creator_customer_id) || (!creator_user_id && !creator_customer_id)) {
    return res.status(400).json({
      error: "Order must be created by either a user OR a customer (exactly one)"
    });
  }

  // لو User أنشأ الطلب لازم customer_id
  if (creator_user_id && !customer_id) {
    return res.status(400).json({
      error: "When a user creates an order, customer_id must be provided"
    });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1) إدخال الطلب
    const [orderResult] = await conn.query(
      `INSERT INTO orders (customer_id, creator_user_id, creator_customer_id, collection_id, position_id)
       VALUES (?, ?, ?, ?, ?)`,
      [customer_id || null, creator_user_id || null, creator_customer_id || null, collection_id || null, position_id]
    );
    const orderId = orderResult.insertId;

    // 2) إدخال «تفصيلة» واحدة فقط
    await conn.query(
      `INSERT INTO order_details
       (order_id, title, description, notes, color, size, capacity,
        prepaid_value, original_product_price, commission, total, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderId,
        resolvedDetail.title,
        resolvedDetail.description || null,
        resolvedDetail.notes || null,
        resolvedDetail.color || null,
        resolvedDetail.size || null,
        resolvedDetail.capacity || null,
        resolvedDetail.prepaid_value ?? 0,
        resolvedDetail.original_product_price ?? 0,
        resolvedDetail.commission ?? 0,
        resolvedDetail.total ?? 0,
        resolvedDetail.image_url || null
      ]
    );

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

   /* // 2) النشاطات بدل history
    const [activityRows] = await pool.query(
      `SELECT * FROM order_activity_log WHERE order_id = ? ORDER BY changed_at DESC`,
      [id]
    );

    order.activities = activityRows;
*/
    res.json(order);
  } catch (err) {
    console.error("Get full order error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}


export async function getOrderWithDetails(req, res) {
  try {
    const { id } = req.params;

    const [rows] = await pool.query(`
      SELECT 
        o.id AS order_id,
        o.customer_id,
        o.creator_user_id,
        o.creator_customer_id,
        o.collection_id,
        o.position_id,
        o.created_at,
        o.updated_at,
        d.id AS detail_id,
        d.title,
        d.description,
        d.notes,
        d.color,
        d.size,
        d.capacity,
        d.prepaid_value,
        d.original_product_price,
        d.commission,
        d.total,
        d.image_url
      FROM orders o
      LEFT JOIN order_details d ON o.id = d.order_id
      WHERE o.id = ?
      ORDER BY d.id
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    const order = {
      order_id: rows[0].order_id,
      customer_id: rows[0].customer_id,
      creator_user_id: rows[0].creator_user_id,
      creator_customer_id: rows[0].creator_customer_id,
      collection_id: rows[0].collection_id,
      position_id: rows[0].position_id,
      created_at: rows[0].created_at,
      updated_at: rows[0].updated_at,
      details: []
    };

    rows.forEach(row => {
      if (row.detail_id) {
        order.details.push({
          detail_id: row.detail_id,
          title: row.title,
          description: row.description,
          notes: row.notes,
          color: row.color,
          size: row.size,
          capacity: row.capacity,
          prepaid_value: row.prepaid_value,
          original_product_price: row.original_product_price,
          commission: row.commission,
          total: row.total,
          image_url: row.image_url
        });
      }
    });

    res.json({
      message: "Order with details fetched successfully",
      order
    });
  } catch (err) {
    console.error("Get order with details error:", err);
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

export async function getOrdersByPosition(req, res) {
  const { positionId } = req.params;

  try {
    const [rows] = await pool.query(
      `
      SELECT 
          o.id AS order_id,
          d.title,
          d.prepaid_value,
          d.total,
          p.name AS position_name,
          CASE
              WHEN o.creator_user_id IS NOT NULL 
                   THEN (SELECT u.name FROM users u WHERE u.id = o.creator_user_id)
              WHEN o.creator_customer_id IS NOT NULL 
                   THEN (SELECT u2.name 
                         FROM customers c2 
                         JOIN users u2 ON c2.user_id = u2.id
                         WHERE c2.id = o.creator_customer_id)
              ELSE NULL
          END AS created_by_name,
          (SELECT u3.name 
           FROM customers c3 
           JOIN users u3 ON c3.user_id = u3.id
           WHERE c3.id = o.customer_id) AS customer_name
      FROM orders o
      JOIN order_position p ON o.position_id = p.id
      LEFT JOIN order_details d ON d.order_id = o.id
      WHERE o.position_id = ?
      `,
      [positionId]
    );

    res.json({
      message: "Orders fetched successfully",
      positionId,
      orders: rows
    });
  } catch (err) {
    console.error("Get orders by position error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}