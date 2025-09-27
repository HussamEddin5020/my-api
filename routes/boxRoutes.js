import express from "express";
import { getBoxes, addBox } from "../controllers/boxController.js";

const router = express.Router();

router.get("/", getBoxes);
router.post("/", addBox);

export default router;
