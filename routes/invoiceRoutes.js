import express from "express";
import { addPurchaseInvoice, getInvoiceByOrder } from "../controllers/invoiceController.js";

const router = express.Router();

// إضافة فاتورة جديدة وربطها بالطلب
router.post("/", addPurchaseInvoice);

// جلب الفاتورة حسب orderId
router.get("/:orderId", getInvoiceByOrder);

export default router;
