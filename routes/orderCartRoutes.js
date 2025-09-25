// routes/orderCartRoutes.js
import express from "express";
import { getOrdersByCart, addOrderToCart, removeOrderFromCart } from "../controllers/orderCartController.js";

const router = express.Router();

router.get("/by-cart/:cartId", getOrdersByCart);          // Orders in cart + تحت الشراء
router.post("/add-to-cart", addOrderToCart);              // إضافة order لسلة
router.put("/remove-from-cart/:orderId", removeOrderFromCart); // إزالة order من سلة

export default router;
