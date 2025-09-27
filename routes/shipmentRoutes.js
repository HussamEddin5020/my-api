import express from "express";
import { getShipments, addShipment, addShipmentImage } from "../controllers/shipmentController.js";

const router = express.Router();

// GET كل الشحنات
router.get("/", getShipments);

// POST اضافة شحنة
router.post("/", addShipment);

// POST اضافة صورة للشحنة
router.post("/image", addShipmentImage);

export default router;
