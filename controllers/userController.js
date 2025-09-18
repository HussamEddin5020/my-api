// controllers/userController.js
import { getUserPermissionsById } from "../queries/userPermissionQueries.js";
import pool from "../config/db.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { logSystemAudit,logUserActivity } from "../utils/auditLogger.js";



import {
  createUser,
  findUserByEmail,
  findUserByPhone,
  findUserById,
  getAllUsers,
  updateUser,
  deleteUser,
} from "../queries/userQueries.js";

dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET;

// 🔹 Register new user
export async function registerUser(req, res) {
  try {
    const { name, email, phone, password, type } = req.body;

    const [emailRows] = await pool.query(findUserByEmail, [email]);
    if (emailRows.length > 0) {
      return res.status(400).json({ error: "Email already exists" });
    }

    const [phoneRows] = await pool.query(findUserByPhone, [phone]);
    if (phoneRows.length > 0) {
      return res.status(400).json({ error: "Phone already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await pool.query(createUser, [
      name,
      email,
      phone,
      hashedPassword,
      type || "customer",
      "active",
    ]);

    const userId = result.insertId;

    // ✅ log REGISTER
    await logSystemAudit({
      actorUserId: userId,
      entityType: "user",
      entityId: userId,
      action: "REGISTER",
      oldData: null,
      newData: { name, email, phone, type },
    });

    // ✅ log ACTIVITY
    await logUserActivity({
      actorUserId: userId,
      actionType: "REGISTER_USER",
      targetEntityType: "user",
      targetEntityId: userId,
      details: { name, email, phone, type },
    });

    res.status(201).json({ message: "User registered successfully", userId });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
// 🔹 Get all users
export async function getUsers(req, res) {
  try {
    const [rows] = await pool.query(getAllUsers);
    res.json(rows);
  } catch (err) {
    console.error("Get users error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// 🔹 Get single user
export async function getUserById(req, res) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(findUserById, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("Get user error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// 🔹 Update user
// 🔹 Update user
export async function updateUserById(req, res) {
  try {
    const { id } = req.params;
    const { name, email, phone, type, status } = req.body;

    const [oldRows] = await pool.query(findUserById, [id]);
    if (oldRows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    const oldData = oldRows[0];

    await pool.query(updateUser, [name, email, phone, type, status, id]);

    const [newRows] = await pool.query(findUserById, [id]);
    const newData = newRows[0];

    // ✅ system audit log
    await logSystemAudit({
      actorUserId: id, // in real app: should be req.user.id (the admin making the change)
      entityType: "user",
      entityId: id,
      action: "UPDATE",
      oldData,
      newData,
    });

    // ✅ activity log
    await logUserActivity({
      actorUserId: id, // again, ideally req.user.id
      actionType: "UPDATE_USER",
      targetEntityType: "user",
      targetEntityId: id,
      details: { oldData, newData },
    });

    res.json({ message: "User updated successfully" });
  } catch (err) {
    console.error("Update user error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// 🔹 Delete user
export async function deleteUserById(req, res) {
  try {
    const { id } = req.params;

    const [oldRows] = await pool.query(findUserById, [id]);
    if (oldRows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    const oldData = oldRows[0];

    await pool.query(deleteUser, [id]);

    // ✅ system audit log
    await logSystemAudit({
      actorUserId: id, // should be req.user.id in real scenario
      entityType: "user",
      entityId: id,
      action: "DELETE",
      oldData,
      newData: null,
    });

    // ✅ activity log
    await logUserActivity({
      actorUserId: id,
      actionType: "DELETE_USER",
      targetEntityType: "user",
      targetEntityId: id,
      details: { oldData },
    });

    res.json({ message: "User deleted successfully" });
  } catch (err) {
    console.error("Delete user error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// 🔹 Get current user info
export async function getMe(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    res.json({
      message: "Current user info",
      user: req.user,
    });
  } catch (err) {
    console.error("GetMe error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// 🔹 Register user with permissions
export async function registerUserWithPermissions(req, res) {
  const { name, email, phone, password, type, status, permissions } = req.body;
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // 🔹 Check for duplicates
    const [emailRows] = await conn.query(`SELECT id FROM users WHERE email = ?`, [email]);
    if (emailRows.length > 0) {
      await conn.rollback();
      return res.status(400).json({ error: "Email already exists" });
    }

    const [phoneRows] = await conn.query(`SELECT id FROM users WHERE phone = ?`, [phone]);
    if (phoneRows.length > 0) {
      await conn.rollback();
      return res.status(400).json({ error: "Phone already exists" });
    }

    // 🔹 Insert user
    const hashedPassword = await bcrypt.hash(password, 10);
    const [userResult] = await conn.query(
      `INSERT INTO users (name, email, phone, password_hash, type, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, email, phone, hashedPassword, type || "customer", status || "active"]
    );
    const userId = userResult.insertId;

    // 🔹 Insert permissions if provided
    if (permissions && permissions.length > 0) {
      const values = permissions.map((p) => [userId, p.action_id, p.permission_id]);
      await conn.query(
        `INSERT INTO user_permissions (user_id, action_id, permission_id) VALUES ?`,
        [values]
      );
    }

    // 🔹 Audit log
    await logSystemAudit({
      actorUserId: userId,
      entityType: "user",
      entityId: userId,
      action: "REGISTER_WITH_PERMISSIONS",
      oldData: null,
      newData: { name, email, phone, type, permissions },
      conn
    });

    await conn.commit();

    res.status(201).json({
      message: "User registered successfully with permissions",
      userId,
    });
  } catch (err) {
    await conn.rollback();
    console.error("Register user with permissions error:", err);
    res.status(500).json({ error: err.message || "Internal server error" }); // 👈 show real reason
  } finally {
    conn.release();
  }
}


// 🔹 Get user permissions
export async function getUserPermissionsApi(req, res) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(getUserPermissionsById, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "No permissions found for this user" });
    }

    res.json({
      userId: id,
      permissions: rows,
    });
  } catch (err) {
    console.error("Get user permissions error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
