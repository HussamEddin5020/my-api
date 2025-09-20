import fs from "fs";   // 🔹 هذا الناقص  
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT, // مهم لـ Aiven
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: {
    ca: fs.readFileSync("certs/ca.pem"), // ✅ الآن fs موجود
  },
});

// اختياري: اختبار الاتصال عند التشغيل
(async () => {
  try {
    const conn = await pool.getConnection();
    console.log("✅ Database connected!");
    conn.release();
  } catch (err) {
    console.error("❌ Database connection failed:", err.message);
  }
})();

export default pool;
