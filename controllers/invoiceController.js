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
