// C:\Users\MMC\Desktop\truckinn-backend\server.js
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");

require("dotenv").config();

const app = express();

const notificationRoutes = require("./routes/notificationRoutes");
app.use("/api/notifications", notificationRoutes);


// --- Core Middlewares ---
app.use(
  cors({
    origin: [
      "https://admin.truckinn.app",
      "https://www.admin.truckinn.app",
      "https://truckinn.app",
      "https://www.truckinn.app"
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// handle preflight requests
app.options("*", cors());


app.use(express.json()); // parse JSON bodies

app.use(express.json()); // parse JSON bodies

const authRoutes = require("./routes/authRoutes");
app.use("/api/auth", authRoutes);

// --- Ensure uploads directory exists (for multer disk storage) ---
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// --- Static serving for uploaded files (CNIC front/back, vehicle docs, driver picture) ---
app.use("/uploads", express.static(uploadsDir));


// ✅ MongoDB Connection
mongoose
  .connect(process.env.MONGODB_URI, { dbName: "truckinn" })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err.message));

// ✅ Routes (make sure these files exist in ./routes)
const commissionRoutes = require("./routes/commissionRoutes");
const userRoutes = require("./routes/userRoutes");
const driverRoutes = require("./routes/driverRoutes");      // 👈 rename to match your file (not driverRoutes.js)
const rideRoutes = require("./routes/rideRoutes");
const ratingRoutes = require("./routes/ratingRoutes");
const vehicleRoutes = require("./routes/vehicles");    // 👈 NEW import (for stats API)
const earningsRoutes = require("./routes/earnings");


app.use("/api/commission", commissionRoutes);
app.use("/api/users", userRoutes);
app.use("/api/drivers", driverRoutes);
app.use("/api/rides", rideRoutes);
app.use("/api/ratings", ratingRoutes);
app.use("/api/vehicles", vehicleRoutes);
app.use("/api/earnings", earningsRoutes);
app.use("/api/dev", require("./routes/devRoutes"));


// ✅ Health Check
app.get("/", (req, res) => {
  res.send("TruckInn Backend Server is Running ✅");
});

// --- Basic error handler (multer/file/validation) ---
app.use((err, req, res, next) => {
  console.error("Global Error:", err);

  // Multer-specific short messages
  if (err && err.name === "MulterError") {
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }

  // Mongoose duplicate key (unique fields) friendly message
  if (err && err.code === 11000) {
    const fields = Object.keys(err.keyPattern || {});
    return res.status(400).json({
      error: `Duplicate value for: ${fields.join(", ")}. Please use unique values.`,
    });
  }

  return res.status(500).json({ error: "Internal Server Error" });
});

// ✅ Start Server (auto-detect correct local IP)
const os = require("os");
function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (
        net.family === "IPv4" &&
        !net.internal &&
        net.address.startsWith("192.168.")
      ) {
        return net.address;
      }
    }
  }
  return "0.0.0.0"; // fallback
}

const PORT = process.env.PORT || 4000;
const HOST = getLocalIP();

app.listen(PORT, HOST, () => {
  console.log(`✅ MongoDB connected`);
  console.log(`🚚 Server running on http://${HOST}:${PORT}`);
});
