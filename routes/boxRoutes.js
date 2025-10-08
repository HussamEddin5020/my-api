import express from "express";
import { addBox, assignOrderToBox,setBoxUnavailableAndMoveOrders, removeOrderFromBox,getUnavailableBoxes,getAvailableBoxes, getAllBoxes, getOrdersByBox , getOrdersNotAssignedInBox} from "../controllers/boxController.js";

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

router.get("/unavailable", getUnavailableBoxes);

router.get("/available", getAvailableBoxes);

router.post("/:boxId/unavailable", setBoxUnavailableAndMoveOrders);



export default router;
