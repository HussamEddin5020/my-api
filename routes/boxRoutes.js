import express from "express";
import { addBox, assignOrderToBox, removeOrderFromBox, getAllBoxes } from "../controllers/boxController.js";

const router = express.Router();

// إضافة صندوق
router.post("/", addBox);

// ربط order بصندوق
router.post("/assign", assignOrderToBox);

// إزالة order من صندوق
router.post("/remove", removeOrderFromBox);

// عرض كل الصناديق
router.get("/", getAllBoxes);

export default router;
