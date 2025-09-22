// routes/userRoutes.js

import express from "express";
import {
  registerUser,
  getUsers,
  getUserById,
  updateUserById,
  deleteUserById,
  getMe,
  registerUserWithPermissions,
  getAccessiblePositions
} from "../controllers/userController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { getUserPermissionsApi } from "../controllers/userController.js";

const router = express.Router();

// Public
router.post("/register", registerUser);


// Protected
router.get("/me", authMiddleware, getMe);
router.get("/", authMiddleware, getUsers);
router.get("/:id", authMiddleware, getUserById);
router.put("/:id", authMiddleware, updateUserById);
router.delete("/:id", authMiddleware, deleteUserById);
router.post("/register-with-perms", registerUserWithPermissions);
router.get("/:id/permissions", authMiddleware, getUserPermissionsApi);
router.get("/positions/accessible", authMiddleware, getAccessiblePositions);


export default router;


