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
  getOrdersByPosition
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

router.get(
  "/by-position/:positionId",
  authMiddleware,
  getOrdersByPosition
);

router.get("/stats/monthly", authMiddleware, getOrdersCountByMonth);

router.get("/stats/by-position", authMiddleware, getOrdersCountByPosition);
export default router;
