// routes/cartRoutes.js
import express from "express";
import { getAllCarts, incrementCart,createCart } from "../controllers/cartController.js";

const router = express.Router();

router.get("/", getAllCarts);            // جلب كل السلات
router.put("/:id/increment", incrementCart); // زيادة orders_count
router.post("/", createCart);

export default router;
