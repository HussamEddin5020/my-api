// index.js
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import userRoutes from "./routes/userRoutes.js";
import customerRoutes from "./routes/customerRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import locationRoutes from "./routes/locationRoutes.js";
import cartRoutes from "./routes/cartRoutes.js";
import orderCartRoutes from "./routes/orderCartRoutes.js";
import shipmentRoutes from "./routes/shipmentRoutes.js";
import boxRoutes from "./routes/boxRoutes.js";
import companyRoutes from "./routes/companyRoutes.js";

dotenv.config();

const app = express();

// Middleware
app.use(express.json());

// ✅ CORS مفتوح للجميع (للتجارب والتطوير)
app.use(
  cors({
    origin: "*", // يسمح لأي دومين
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Routes
app.use(express.json({ limit: "10mb" })); // عشان نسمح برفع base64 كبيرة
app.use("/api/shipments", shipmentRoutes);
app.use("/api/boxes", boxRoutes);
app.use("/api/companies", companyRoutes);

app.use("/api/users", userRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api", authRoutes);
app.use("/api", locationRoutes);
app.use("/api/carts", cartRoutes);
app.use("/api/orders", orderCartRoutes);
// Root Test
app.get("/", (req, res) => {
  res.send("Nazil API Service is running 🚀");
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Nazil API Service running on port ${PORT}`);
});
