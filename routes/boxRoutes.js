import express from "express";
import { addBox, assignOrderToBox, removeOrderFromBox, getAllBoxes, getOrdersByBox , getOrdersNotAssignedInBox} from "../controllers/boxController.js";

const router = express.Router();

// إضافة صندوق
router.post("/", addBox);

// ربط order بصندوق
router.post("/assign", assignOrderToBox);

// إزالة order من صندوق
router.post("/remove", removeOrderFromBox);

// عرض كل الصناديق
router.get("/", getAllBoxes);

router.get("/:boxId/orders", getOrdersByBox);

router.get("/orders/not-assigned", getOrdersNotAssignedInBox);

export default router;
