// controllers/authController.js
import pool from "../config/db.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { logSystemAudit, logCustomerAudit } from "../utils/auditLogger.js";

dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET;

export async function login(req, res) {
  const { email, password } = req.body;

  try {
    // 1) Find user by email (any type)
    const [rows] = await pool.query(
      `SELECT * FROM users WHERE email = ?`,
      [email]
    );

    if (rows.length === 0) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const user = rows[0];

    // 2) Check password
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    // 3) Generate JWT
    const token = jwt.sign(
      { id: user.id, type: user.type },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    // 4) Audit logs (separate per type)
  /*  if (user.type === "customer") {
      await logCustomerAudit({
        actorCustomerId: user.id,
        entityType: "customer",
        entityId: user.id,
        action: "LOGIN",
        oldData: null,
        newData: { email: user.email }
      });
    } else {
      await logSystemAudit({
        actorUserId: user.id,
        entityType: "user",
        entityId: user.id,
        action: "LOGIN",
        oldData: null,
        newData: { email: user.email }
      });
    }*/

    // 5) Save login event
    await pool.query(
      `INSERT INTO login_events (user_id, login_time) VALUES (?, NOW())`,
      [user.id]
    );

    // 6) Response
    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        type: user.type,
        status: user.status
      }
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
