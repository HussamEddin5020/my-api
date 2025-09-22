// routes/customerRoutes.js
import express from "express";
import {
  registerCustomer,
  getCustomers,
  getCustomer,
  updateCustomerById,
  deleteCustomerById,
  getCustomerDetailsApi,
  getAllCustomerDetailsApi,
  getMyCustomer,

} from "../controllers/customerController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

// ✅ Public routes
router.post("/register", registerCustomer);

// ✅ Protected routes
router.get("/", authMiddleware, getCustomers); // لو عايز تجيب قائمة بسيطة
router.get("/details/all", authMiddleware, getAllCustomerDetailsApi); // عشان ما يتعارضش مع "/:id"
router.get("/:id", authMiddleware, getCustomer);
router.get("/:id/details", authMiddleware, getCustomerDetailsApi);
router.put("/:id", authMiddleware, updateCustomerById);
router.delete("/:id", authMiddleware, deleteCustomerById);
router.get("/simple/Customer", getMyCustomer);


export default router;
