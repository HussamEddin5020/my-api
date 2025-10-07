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





// Orders with position_id = 2 AND is_archived = 1
export async function getArchivedPos2Orders(req, res) {
  try {
    const [rows] = await pool.query(
      `
      SELECT 
          o.id AS order_id,
          d.title,
          d.prepaid_value,
          d.total,

          -- الإضافات الجديدة
          o.purchase_method,
          o.invoice_id,
          pi.invoice_image_base64 AS invoice_base64,

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
      JOIN order_position p   ON o.position_id = p.id
      LEFT JOIN order_details d ON d.order_id = o.id
      LEFT JOIN purchase_invoices pi ON pi.id = o.invoice_id
      WHERE o.position_id = 2
        AND o.is_archived = 1
      ORDER BY o.created_at DESC
      `
    );

    res.json({
      message: "Archived position=2 orders fetched successfully",
      orders: rows
    });
  } catch (err) {
    console.error("getArchivedPos2Orders error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Orders with position_id = 2 AND is_archived = 0
export async function getUnarchivedPos2Orders(req, res) {
  try {
    const [rows] = await pool.query(
      `
      SELECT 
          o.id AS order_id,
          d.title,
          d.prepaid_value,
          d.total,

          -- الإضافات الجديدة
          o.purchase_method,
          o.invoice_id,
          pi.invoice_image_base64 AS invoice_base64,

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
      JOIN order_position p   ON o.position_id = p.id
      LEFT JOiN order_details d ON d.order_id = o.id
      LEFT JOIN purchase_invoices pi ON pi.id = o.invoice_id
      WHERE o.position_id = 2
        AND o.is_archived = 0
      ORDER BY o.created_at DESC
      `
    );

    res.json({
      message: "Unarchived position=2 orders fetched successfully",
      orders: rows
    });
  } catch (err) {
    console.error("getUnarchivedPos2Orders error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}






/** helper: يرجّع purchase_method + invoice_base64 */
async function fetchOrderWithInvoice(orderId) {
  const [rows] = await pool.query(
    `SELECT
        o.id AS order_id,
        o.cart_id,
        o.is_archived,
        o.purchase_method,
        o.invoice_id,
        pi.invoice_image_base64 AS invoice_base64
     FROM orders o
     LEFT JOIN purchase_invoices pi ON pi.id = o.invoice_id
     WHERE o.id = ?`,
    [orderId]
  );
  return rows[0] || null;
}

/**
 * PATCH /api/orders/pos2/archived/:id
 * يحدّث طلب مؤرشف (position_id=2 & is_archived=1)
 * الحقول المسموح بها (كلها اختيارية): 
 *   cart_id, invoice_id, purchase_method, barcode, box_id, collection_id,
 *   customer_id, creator_user_id, creator_customer_id
 * ملاحظة: لو تم تمرير cart_id = null ⇒ يُحوَّل is_archived = 0 تلقائيًا
 */
export async function updateArchivedPos2Order(req, res) {
  const { id } = req.params;
  if (!id || Number.isNaN(Number(id))) {
    return res.status(400).json({ error: "Valid order id is required" });
  }

  // الحقول المسموح تحديثها
  const allowed = [
    "cart_id","invoice_id","purchase_method","barcode","box_id","collection_id",
    "customer_id","creator_user_id","creator_customer_id"
  ];

  const sets = [];
  const vals = [];
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(req.body, key)) {
      sets.push(`${key} = ?`);
      // نعالج سلاسل فارغة لتصبح NULL (اختياريًا مفيد)
      const v = req.body[key];
      vals.push(v === "" ? null : v);
    }
  }
  if (sets.length === 0) {
    return res.status(400).json({ error: "No fields provided to update" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // تأكيد الحالة: position_id=2 & is_archived=1
    const [[found]] = await conn.query(
      `SELECT id, position_id, is_archived, cart_id
       FROM orders
       WHERE id = ? AND position_id = 2 AND is_archived = 1
       FOR UPDATE`,
      [id]
    );
    if (!found) {
      await conn.rollback(); conn.release();
      return res.status(404).json({ error: "Archived pos=2 order not found" });
    }

    // تنفيذ التحديث الجزئي
    await conn.query(`UPDATE orders SET ${sets.join(", ")} WHERE id = ?`, [...vals, id]);

    // منطق إلغاء الأرشفة إذا أُرسِل cart_id = null صراحةً
    let becameUnarchived = false;
    if (Object.prototype.hasOwnProperty.call(req.body, "cart_id") && req.body.cart_id == null) {
      await conn.query(`UPDATE orders SET is_archived = 0 WHERE id = ?`, [id]);
      becameUnarchived = true;
    }

    await conn.commit();

    const details = await fetchOrderWithInvoice(id);
    conn.release();
    return res.json({
      message: becameUnarchived
        ? "Archived order updated and unarchived due to NULL cart_id"
        : "Archived pos=2 order updated successfully",
      order_id: Number(id),
      is_archived: becameUnarchived ? 0 : 1,
      purchase_method: details?.purchase_method ?? null,
      invoice: details?.invoice_id
        ? { invoice_id: details.invoice_id, invoice_base64: details.invoice_base64 ?? null }
        : null
    });
  } catch (err) {
    try { await conn.rollback(); } catch {}
    conn.release();
    console.error("updateArchivedPos2Order error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * PATCH /api/orders/pos2/unarchived/:id
 * يحدّث طلب غير مؤرشف (position_id=2 & is_archived=0)
 * نفس الحقول المسموح بها أعلاه. لا منطق خاص هنا.
 */
export async function updateUnarchivedPos2Order(req, res) {
  const { id } = req.params;
  if (!id || Number.isNaN(Number(id))) {
    return res.status(400).json({ error: "Valid order id is required" });
  }

  const allowed = [
    "cart_id","invoice_id","purchase_method","barcode","box_id","collection_id",
    "customer_id","creator_user_id","creator_customer_id"
  ];
  const sets = [];
  const vals = [];
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(req.body, key)) {
      sets.push(`${key} = ?`);
      const v = req.body[key];
      vals.push(v === "" ? null : v);
    }
  }
  if (sets.length === 0) {
    return res.status(400).json({ error: "No fields provided to update" });
  }

  try {
    // تأكيد الحالة: position_id=2 & is_archived=0
    const [check] = await pool.query(
      `SELECT id FROM orders WHERE id = ? AND position_id = 2 AND is_archived = 0`,
      [id]
    );
    if (check.length === 0) {
      return res.status(404).json({ error: "Unarchived pos=2 order not found" });
    }

    const [upd] = await pool.query(
      `UPDATE orders SET ${sets.join(", ")} WHERE id = ?`,
      [...vals, id]
    );
    if (upd.affectedRows === 0) {
      return res.status(500).json({ error: "Failed to update order" });
    }

    const details = await fetchOrderWithInvoice(id);
    return res.json({
      message: "Unarchived pos=2 order updated successfully",
      order_id: Number(id),
      is_archived: details?.is_archived ?? 0,
      purchase_method: details?.purchase_method ?? null,
      invoice: details?.invoice_id
        ? { invoice_id: details.invoice_id, invoice_base64: details.invoice_base64 ?? null }
        : null
    });
  } catch (err) {
    console.error("updateUnarchivedPos2Order error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}





export async function getOrdersByPositionID(req, res) {
  const { positionId } = req.params; // نقرأ البارامتر من الراوت
  try {
    const [rows] = await pool.query(
      `SELECT o.id,
              o.customer_id,
              u.name AS customer_name,
              o.creator_user_id,
              o.creator_customer_id,
              o.collection_id,
              o.position_id,
              o.created_at,
              o.cart_id
       FROM orders o
       JOIN customers c ON o.customer_id = c.id
       JOIN users u ON c.user_id = u.id
       WHERE o.position_id = ?`,
      [positionId]
    );

    res.json({
      message: "Orders fetched successfully",
      orders: rows
    });
  } catch (err) {
    console.error("Get orders by position error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}




// ➊ إضافة أو تحديث باركود حسب orderId
export async function addOrUpdateOrderBarcode(req, res) {
  const { orderId, barcode } = req.body;

  if (!orderId || !barcode) {
    return res.status(400).json({ error: "orderId and barcode are required" });
  }

  try {
    const [result] = await pool.query(
      "UPDATE orders SET barcode = ? WHERE id = ?",
      [barcode, orderId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json({
      message: "Barcode added/updated successfully",
      orderId,
      barcode,
    });
  } catch (err) {
    console.error("Add/Update barcode error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}



// مسح الباركود من الطلب حسب orderId (من الرابط)
export async function deleteOrderBarcode(req, res) {
  const { orderId } = req.params;


  if (!orderId) {
    return res.status(400).json({ error: "orderId is required" });
  }

  try {
    const [result] = await pool.query(
      "UPDATE orders SET barcode = NULL WHERE id = ?",
      [orderId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json({
      message: "Barcode cleared successfully",
      orderId,
    });
  } catch (err) {
    console.error("Clear barcode error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}




// إضافة أو تحديث طريقة الشراء
export async function addOrUpdatePurchaseMethod(req, res) {
  const { orderId, purchaseMethod } = req.body;

  if (!orderId || !purchaseMethod) {
    return res.status(400).json({ error: "orderId and purchaseMethod are required" });
  }

  try {
    const [result] = await pool.query(
      "UPDATE orders SET purchase_method = ? WHERE id = ?",
      [purchaseMethod, orderId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json({
      message: "Purchase method added/updated successfully",
      orderId,
      purchaseMethod,
    });
  } catch (err) {
    console.error("Add/Update purchase method error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}


// تغيير position_id إلى 3 وفق الشروط
export async function moveOrderToPosition3(req, res) {
  const { orderId } = req.body;

  if (!orderId) {
    return res.status(400).json({ error: "orderId is required" });
  }

  try {
    // تنفيذ التحديث مع الشروط
    const [result] = await pool.query(
      `UPDATE orders
       SET position_id = 3
       WHERE id = ?
         AND invoice_id IS NOT NULL
         AND purchase_method IS NOT NULL
         AND purchase_method <> ''
         AND position_id = 2`,
      [orderId]
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({
        error: "Order does not meet the required conditions or not found",
      });
    }

    res.json({
      message: "Order moved to position_id = 3 successfully",
      orderId,
    });
  } catch (err) {
    console.error("Move order to position 3 error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}


export async function moveOrderToPosition4(req, res) {
  const { shipmentId } = req.params;

  if (!shipmentId) {
    return res.status(400).json({ error: "shipmentId is required" });
  }

  try {
    // 1) جلب بيانات الشحنة والتحقق من استيفاء الشروط
    const [rows] = await pool.query(
      `SELECT box_id, company_id, sender_name, weight
       FROM shipments
       WHERE id = ?`,
      [shipmentId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Shipment not found" });
    }

    const { box_id, company_id, sender_name, weight } = rows[0];

    if (
      box_id == null ||
      company_id == null ||
      weight == null ||
      sender_name == null ||
      String(sender_name).trim() === ""
    ) {
      return res.status(400).json({
        error:
          "Shipment is missing required details (box_id, company_id, sender_name, weight)."
      });
    }

    // 2) تحديث الطلبات المرتبطة بنفس الـ box إلى الحالة 4 بشرط أن تكون حالتها الحالية 3
    const [upd] = await pool.query(
      `UPDATE orders
       SET position_id = 4
       WHERE box_id = ?
         AND position_id = 3`,
      [box_id]
    );

    if (upd.affectedRows === 0) {
      return res.status(400).json({
        error:
          "No orders were moved. Make sure there are orders with this box_id and position_id = 3."
      });
    }

    return res.json({
      message: "Orders moved to position_id = 4 successfully",
      shipmentId,
      box_id,
      affected_orders: upd.affectedRows
    });
  } catch (err) {
    console.error("moveOrderToPosition4 error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}


export async function getPos3OrdersNotReady(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT o.id AS order_id,
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
       WHERE o.position_id = 3
         AND ( (o.barcode IS NULL OR o.barcode = '') OR o.box_id IS NULL )
       ORDER BY o.created_at DESC`
    );

    res.json({
      message: "POS=3 (not ready) orders fetched successfully",
      orders: rows
    });
  } catch (err) {
    console.error("getPos3OrdersNotReady error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// جاهزة: position=3 وبها باركود وصندوق معًا
export async function getPos3OrdersReady(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT o.id AS order_id,
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
       WHERE o.position_id = 3
         AND o.box_id IS NOT NULL
         AND o.barcode IS NOT NULL
         AND o.barcode <> ''
       ORDER BY o.created_at DESC`
    );

    res.json({
      message: "POS=3 (ready) orders fetched successfully",
      orders: rows
    });
  } catch (err) {
    console.error("getPos3OrdersReady error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function moveOrdersPos4To5ByBox(req, res) {
  const { boxId } = req.params;

  if (!boxId) {
    return res.status(400).json({ error: "boxId is required" });
  }

  try {
    // 1) تحقق من الصندوق وأنه غير متاح
    const [boxRows] = await pool.query(
      "SELECT id, is_available FROM box WHERE id = ?",
      [boxId]
    );

    if (boxRows.length === 0) {
      return res.status(404).json({ error: "Box not found" });
    }
    if (boxRows[0].is_available !== 0) {
      return res
        .status(400)
        .json({ error: "Box must be unavailable (is_available = 0) to move orders" });
    }

    // 2) حدث الطلبات: position_id 4 → 5 إذا كانت مرتبطة بهذا الصندوق
    const [result] = await pool.query(
      `
      UPDATE orders o
      JOIN box b ON o.box_id = b.id
      SET o.position_id = 5
      WHERE o.box_id = ?
        AND o.position_id = 4
        AND b.is_available = 0
      `,
      [boxId]
    );

    return res.json({
      message: "Orders moved from position_id 4 to 5 successfully",
      boxId: Number(boxId),
      moved_count: result.affectedRows
    });
  } catch (err) {
    console.error("moveOrdersPos4To5ByBox error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}


export async function getOrderCartId(req, res) {
  const { orderId } = req.params;

  if (!orderId || Number.isNaN(Number(orderId))) {
    return res.status(400).json({ error: "Valid orderId is required" });
  }

  try {
    const [[row]] = await pool.query(
      "SELECT cart_id FROM orders WHERE id = ?",
      [orderId]
    );

    if (!row) {
      return res.status(404).json({ error: "Order not found" });
    }

    // يرجّع cart_id فقط (قد يكون null)
    return res.json({ cart_id: row.cart_id });
  } catch (err) {
    console.error("getOrderCartId error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}




// جعل الطلب مؤرشفًا (is_archived = 1)
export async function archiveOrder(req, res) {
  const { id } = req.params;
  if (!id || Number.isNaN(Number(id))) {
    return res.status(400).json({ error: "Valid order id is required" });
  }

  try {
    // (اختياري) تحقق من وجود الطلب وحالته الحالية
    const [[row]] = await pool.query("SELECT id, is_archived FROM orders WHERE id = ?", [id]);
    if (!row) return res.status(404).json({ error: "Order not found" });
    if (row.is_archived === 1) {
      return res.json({ message: "Order already archived", order_id: Number(id), is_archived: 1 });
    }

    const [result] = await pool.query("UPDATE orders SET is_archived = 1 WHERE id = ?", [id]);
    if (result.affectedRows === 0) {
      return res.status(500).json({ error: "Failed to archive order" });
    }

    return res.json({ message: "Order archived successfully", order_id: Number(id), is_archived: 1 });
  } catch (err) {
    console.error("archiveOrder error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// إلغاء الأرشفة (is_archived = 0)
export async function unarchiveOrder(req, res) {
  const { id } = req.params;
  if (!id || Number.isNaN(Number(id))) {
    return res.status(400).json({ error: "Valid order id is required" });
  }

  try {
    const [[row]] = await pool.query("SELECT id, is_archived FROM orders WHERE id = ?", [id]);
    if (!row) return res.status(404).json({ error: "Order not found" });
    if (row.is_archived === 0) {
      return res.json({ message: "Order already unarchived", order_id: Number(id), is_archived: 0 });
    }

    const [result] = await pool.query("UPDATE orders SET is_archived = 0 WHERE id = ?", [id]);
    if (result.affectedRows === 0) {
      return res.status(500).json({ error: "Failed to unarchive order" });
    }

    return res.json({ message: "Order unarchived successfully", order_id: Number(id), is_archived: 0 });
  } catch (err) {
    console.error("unarchiveOrder error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}


export async function applyPurchaseToOrder(req, res) {
  const { orderId } = req.params;
  const { purchase_method, invoice_base64, cart_id } = req.body || {};

  // تحقق من المدخلات الأساسية
  if (!orderId || Number.isNaN(Number(orderId))) {
    return res.status(400).json({ error: "Valid orderId is required" });
  }
  if (!purchase_method || typeof purchase_method !== "string") {
    return res.status(400).json({ error: "purchase_method is required (string)" });
  }
  if (!invoice_base64 || typeof invoice_base64 !== "string" || invoice_base64.trim() === "") {
    return res.status(400).json({ error: "invoice_base64 is required (non-empty string)" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1) تأكيد وجود الطلب وقفل صفّه
    const [[order]] = await conn.query(
      `SELECT id FROM orders WHERE id = ? FOR UPDATE`,
      [orderId]
    );
    if (!order) {
      await conn.rollback(); conn.release();
      return res.status(404).json({ error: "Order not found" });
    }

    // 2) إدراج الفاتورة في purchase_invoices
    const [ins] = await conn.query(
      `INSERT INTO purchase_invoices (invoice_image_base64) VALUES (?)`,
      [invoice_base64]
    );
    const newInvoiceId = ins.insertId;

    // 3) تحديث الطلب: purchase_method + invoice_id (+ cart_id إن أُرسل)
    const sets = [`purchase_method = ?`, `invoice_id = ?`];
    const vals = [purchase_method, newInvoiceId];

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "cart_id")) {
      // تم إرسال cart_id صراحةً (حتى لو null)
      sets.push(`cart_id = ?`);
      vals.push(cart_id ?? null);
    }

    const [upd] = await conn.query(
      `UPDATE orders SET ${sets.join(", ")} WHERE id = ?`,
      [...vals, orderId]
    );
    if (upd.affectedRows === 0) {
      throw new Error("Failed to update order");
    }

    await conn.commit();
    conn.release();

    return res.json({
      message: "Purchase applied and invoice linked successfully",
      order_id: Number(orderId),
      purchase_method,
      invoice_id: newInvoiceId,
      cart_id: Object.prototype.hasOwnProperty.call(req.body || {}, "cart_id")
        ? (cart_id ?? null)
        : undefined
    });
  } catch (err) {
    try { await conn.rollback(); } catch {}
    conn.release();
    console.error("applyPurchaseToOrder error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}