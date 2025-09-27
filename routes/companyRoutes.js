import express from "express";
import { getCompanies, addCompany } from "../controllers/companyController.js";

const router = express.Router();

router.get("/", getCompanies);
router.post("/", addCompany);

export default router;
