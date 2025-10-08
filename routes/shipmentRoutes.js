import express from "express";
import { addShipment, addShipmentImage, getShipments, updateShipment, getReadyShipments, getShippingShipments, markShipmentArrivedAndPromoteOrders } from "../controllers/shipmentController.js";

const router = express.Router();

// إضافة شحنة جديدة (مع صور اختيارية)
router.post("/", addShipment);

router.get("/", getShipments);

// إضافة صورة لشحنة موجودة
router.post("/image", addShipmentImage);

router.put("/:id", updateShipment);

router.get("/ready", getReadyShipments); // GET /api/shipments/ready

router.get("/shipping", getShippingShipments);

router.post("/:shipmentId/arrive", markShipmentArrivedAndPromoteOrders);

export default router;
