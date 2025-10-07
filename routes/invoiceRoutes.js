import express from "express";
import { addPurchaseInvoice, getInvoiceByOrder, replaceOrderInvoice } from "../controllers/invoiceController.js";

const router = express.Router();

// إضافة فاتورة جديدة وربطها بالطلب
router.post("/", addPurchaseInvoice);

// جلب الفاتورة حسب orderId
router.get("/:orderId", getInvoiceByOrder);


// استبدال فاتورة طلب (يحذف القديمة ثم يضيف الجديدة)
router.post("/orders/:orderId/invoice/replace", replaceOrderInvoice);

export default router;
