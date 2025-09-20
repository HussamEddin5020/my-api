import express from "express";
import { getCities, getAreasByCity } from "../controllers/locationController.js";

const router = express.Router();

// جلب المدن
router.get("/cities", getCities);

// جلب المناطق حسب المدينة
router.get("/cities/:cityId/areas", getAreasByCity);

export default router;
