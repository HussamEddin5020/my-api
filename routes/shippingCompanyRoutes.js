import express from "express";
import { addShippingCompany, getShippingCompanies } from "../controllers/shippingCompanyController.js";

const router = express.Router();

// إضافة شركة شحن جديدة
router.post("/", addShippingCompany);

// جلب شركات الشحن
router.get("/", getShippingCompanies);

export default router;
