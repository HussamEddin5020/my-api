// server.js (أو index.js)

import express from "express";
import dotenv from "dotenv";
import userRoutes from "./routes/userRoutes.js";
import customerRoutes from "./routes/customerRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import authRoutes from "./routes/authRoutes.js";




dotenv.config();

const app = express();

// Middleware عام
app.use(express.json()); // قراءة JSON body

// Routes
app.use("/api/users", userRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api", authRoutes);

// Root Test
app.get("/", (req, res) => {
  res.send("Nazil API Service is running 🚀");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Nazil API Service running on port ${PORT}`);
});
