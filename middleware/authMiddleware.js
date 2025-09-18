// middleware/authMiddleware.js
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET;

// Middleware للتحقق من JWT
export function authMiddleware(req, res, next) {
  const authHeader = req.headers["authorization"];

  // لازم يكون في شكل: Bearer token
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id: xxx, type: "system" | "customer" }
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
