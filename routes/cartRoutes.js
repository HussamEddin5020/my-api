// routes/cartRoutes.js
import express from "express";
import { getAllCarts, incrementCart,createCart, getOrdersByCartId,  setCartUnavailable} from "../controllers/cartController.js";

const router = express.Router();

router.get("/", getAllCarts);            // جلب كل السلات
router.put("/:id/increment", incrementCart); // زيادة orders_count
router.post("/", createCart);
router.get("/:cartId/orders", getOrdersByCartId);
// تغيير حالة السلة إلى غير متاحة (0)
router.post("/:cartId/unavailable", setCartUnavailable);

export default router;
