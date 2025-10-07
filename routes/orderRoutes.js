// routes/orderRoutes.js
import express from "express";
import { checkPermission } from "../middleware/checkPermission.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import {
  createNewOrder,
  deleteOrderById,
  getFullOrder,
  createFullOrder,
  updateOrderUnified,
  getOrdersCountByPosition,
  getOrdersCountByMonth,
  getOrderWithDetails,
  getOrdersByPositionID,
  addOrUpdateOrderBarcode,
  deleteOrderBarcode,
  addOrUpdatePurchaseMethod,
  moveOrderToPosition3,
  moveOrderToPosition4,
  getPos3OrdersNotReady,
  getPos3OrdersReady,
  moveOrdersPos4To5ByBox,
  getOrderCartId,
  getArchivedPos2Orders,
  getUnarchivedPos2Orders,
  unarchiveOrder,
  archiveOrder,
  updateArchivedPos2Order,
  updateUnarchivedPos2Order

  

} from "../controllers/orderController.js";


const router = express.Router();

// إنشاء طلب بسيط
router.post("/", authMiddleware, createNewOrder);

// حذف طلب
router.delete("/:id", authMiddleware, deleteOrderById);

// جلب طلب كامل + الأنشطة (من order_activity_log)
router.get("/:id/full", authMiddleware, getFullOrder);

// إنشاء طلب كامل
router.post("/full", authMiddleware, createFullOrder);

//router.put("/:id", authMiddleware, updateOrderUnified);

router.put(
  "/:id",
  authMiddleware,                       // يقرأ JWT
  checkPermission("purchased", "update"), // يتأكد إن عنده صلاحية
  updateOrderUnified                    // يستخدم unified
);



router.get("/:id/with-details", authMiddleware, getOrderWithDetails);

router.get("/stats/monthly", authMiddleware, getOrdersCountByMonth);

router.get("/stats/by-position", authMiddleware, getOrdersCountByPosition);

router.get("/position/:positionId", getOrdersByPositionID);


// إضافة / تحديث باركود
router.post("/barcode", addOrUpdateOrderBarcode);

// حذف باركود
router.delete("/barcode/:orderId", deleteOrderBarcode);

router.post("/purchase-method", addOrUpdatePurchaseMethod);

router.post("/move-to-pos3", moveOrderToPosition3);

router.post("/move-to-pos4/:shipmentId", moveOrderToPosition4);


// غير جاهزة
router.get("/pos3/not-ready", getPos3OrdersNotReady);

// جاهزة
router.get("/pos3/ready", getPos3OrdersReady);

router.post("/box/:boxId/move-4-to-5", moveOrdersPos4To5ByBox);

router.get("/:orderId/cart-id", getOrderCartId);


// المؤرشفة (position_id=2 & is_archived=1)
router.get("/pos2/archived", getArchivedPos2Orders);

// غير المؤرشفة (position_id=2 & is_archived=0)
router.get("/pos2/unarchived", getUnarchivedPos2Orders);


// POST /api/orders/:id/archive     → is_archived = 1
router.post("/:id/archive", archiveOrder);

// POST /api/orders/:id/unarchive   → is_archived = 0
router.post("/:id/unarchive", unarchiveOrder);

router.post("/pos2/archived/:id/update", updateArchivedPos2Order);

// تحديث طلب غير مؤرشف (pos=2 & archived=0)
router.post("/pos2/unarchived/:id/update", updateUnarchivedPos2Order);

export default router;
