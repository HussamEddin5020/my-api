import pool from "../config/db.js";

// إضافة فاتورة جديدة وربطها بالطلب
export async function addPurchaseInvoice(req, res) {
  const { orderId, invoiceBase64 } = req.body;

  if (!orderId || !invoiceBase64) {
    return res.status(400).json({ error: "orderId and invoiceBase64 are required" });
  }

  try {
    // 1) إدخال الفاتورة في جدول purchase_invoices
    const [invoiceResult] = await pool.query(
      "INSERT INTO purchase_invoices (invoice_image_base64) VALUES (?)",
      [invoiceBase64]
    );

    const invoiceId = invoiceResult.insertId;

    // 2) تحديث جدول الطلبات وربط الفاتورة
    await pool.query(
      "UPDATE orders SET invoice_id = ? WHERE id = ?",
      [invoiceId, orderId]
    );

    res.json({
      message: "Invoice added and linked to order successfully",
      invoiceId,
      orderId
    });
  } catch (err) {
    console.error("Add invoice error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// جلب الفاتورة الخاصة بطلب
export async function getInvoiceByOrder(req, res) {
  const { orderId } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT pi.id AS invoice_id, pi.invoice_image_base64
       FROM orders o
       JOIN purchase_invoices pi ON o.invoice_id = pi.id
       WHERE o.id = ?`,
      [orderId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "No invoice found for this order" });
    }

    res.json({
      message: "Invoice fetched successfully",
      invoice: rows[0]
    });
  } catch (err) {
    console.error("Get invoice error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}


/**
 * POST /api/orders/:orderId/invoice/replace
 * body: { oldInvoiceId: number, invoiceBase64: string }
 *
 * الخطوات:
 * 1) قفل سجل الطلب والتأكد من وجوده
 * 2) التحقق أن oldInvoiceId = orders.invoice_id (إن كان موجودًا)
 * 3) حذف الفاتورة القديمة من purchase_invoices
 * 4) إدراج الفاتورة الجديدة وربطها بالطلب
 */
export async function replaceOrderInvoice(req, res) {
  const { orderId } = req.params;
  const { oldInvoiceId, invoiceBase64 } = req.body;

  // تحققات أساسية
  if (!orderId || Number.isNaN(Number(orderId))) {
    return res.status(400).json({ error: "Valid orderId is required" });
  }
  if (!oldInvoiceId || Number.isNaN(Number(oldInvoiceId))) {
    return res.status(400).json({ error: "Valid oldInvoiceId is required" });
  }
  if (!invoiceBase64 || typeof invoiceBase64 !== "string" || invoiceBase64.trim() === "") {
    return res.status(400).json({ error: "invoiceBase64 is required" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1) قفل الطلب والتحقق من الفاتورة الحالية
    const [[order]] = await conn.query(
      `SELECT id, invoice_id FROM orders WHERE id = ? FOR UPDATE`,
      [orderId]
    );
    if (!order) {
      await conn.rollback(); conn.release();
      return res.status(404).json({ error: "Order not found" });
    }

    // تأكد أن oldInvoiceId يطابق الفاتورة الحالية (إن كانت موجودة)
    if (order.invoice_id !== null && Number(order.invoice_id) !== Number(oldInvoiceId)) {
      await conn.rollback(); conn.release();
      return res.status(400).json({
        error: "oldInvoiceId does not match the current order invoice_id"
      });
    }

    // 2) حذف الفاتورة القديمة (سيجعل orders.invoice_id = NULL تلقائيًا بفضل FK ON DELETE SET NULL)
    const [del] = await conn.query(
      `DELETE FROM purchase_invoices WHERE id = ?`,
      [oldInvoiceId]
    );
    if (del.affectedRows === 0) {
      // ليست قاتلة، لكن ننبه
      // بإمكانك بدل هذا إرجاع 404 لو أردت الإلزام بوجود القديمة
      // await conn.rollback(); conn.release(); return res.status(404)...
    }

    // 3) إدراج الفاتورة الجديدة
    const [ins] = await conn.query(
      `INSERT INTO purchase_invoices (invoice_image_base64) VALUES (?)`,
      [invoiceBase64]
    );
    const newInvoiceId = ins.insertId;

    // 4) ربط الطلب بالفاتورة الجديدة
    const [upd] = await conn.query(
      `UPDATE orders SET invoice_id = ? WHERE id = ?`,
      [newInvoiceId, orderId]
    );
    if (upd.affectedRows === 0) {
      throw new Error("Failed to link new invoice to the order");
    }

    await conn.commit();
    conn.release();

    return res.json({
      message: "Invoice replaced and linked to order successfully",
      orderId: Number(orderId),
      oldInvoiceId: Number(oldInvoiceId),
      newInvoiceId
    });
  } catch (err) {
    try { await conn.rollback(); } catch {}
    conn.release();
    console.error("replaceOrderInvoice error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
