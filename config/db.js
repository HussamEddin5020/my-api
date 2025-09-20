import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

// 🔹 حل مشكلة المسارات المطلقة
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🔹 المسار الصحيح للـ ca.pem (خارج config)
const caPath = path.join(__dirname, "../certs/ca.pem");
console.log("📂 Using CA cert path:", caPath);

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: {
    ca: fs.readFileSync(caPath),
  },
});

// ✅ اختبار الاتصال
(async () => {
  try {
    const conn = await pool.getConnection();
    console.log("✅ Database connected!");
    conn.release();
  } catch (err) {
    console.error("❌ Database connection failed:");
    console.error("Code:", err.code);
    console.error("Message:", err.message);
    console.error("Stack:", err.stack);
  }
})();

export default pool;
