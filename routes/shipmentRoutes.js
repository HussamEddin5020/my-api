import express from "express";
import { addShipment, addShipmentImage, getShipments } from "../controllers/shipmentController.js";

const router = express.Router();

// إضافة شحنة جديدة (مع صور اختيارية)
router.post("/", addShipment);

router.get("/", getShipments);

// إضافة صورة لشحنة موجودة
router.post("/image", addShipmentImage);

export default router;
