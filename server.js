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
app.use(cors());
app.use(express.json()); // parse JSON bodies

const authRoutes = require("./routes/authRoutes");
app.use("/api/admin", authRoutes);

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

// ✅ Helper to get Wi-Fi / LAN IP only
function getLocalIP() {
  const os = require("os");
  const interfaces = os.networkInterfaces();

  for (const name in interfaces) {
    for (const iface of interfaces[name]) {
      // Skip internal & Docker/VPN addresses
      if (
        iface.family === "IPv4" &&
        !iface.internal &&
        !iface.address.startsWith("172.") &&  // skip Docker/WireGuard
        !iface.address.startsWith("169.")     // skip link-local
      ) {
        return iface.address; // e.g. 192.168.x.x
      }
    }
  }
  return "0.0.0.0"; // fallback
}


// ✅ Start Server (with Socket.io)
const http = require("http");
const { Server } = require("socket.io");

const server = http.createServer(app);
const PORT = process.env.PORT || 4000;
const HOST = getLocalIP();

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PATCH"],
  },
});
app.set("io", io);

// 🔹 When client connects
io.on("connection", (socket) => {
  console.log("🔌 Socket connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("❌ Socket disconnected:", socket.id);
  });
});

module.exports.io = io;

// ✅ Auto-update UserApp .env with current IP
const envFile = path.join(__dirname, "../TruckInn/UserApp/.env");
try {
  const content = `EXPO_PUBLIC_BASE_URL=http://${HOST}:${PORT}\n`;
  fs.writeFileSync(envFile, content);
  console.log("🌍 .env updated for UserApp:", content.trim());
} catch (err) {
  console.error("⚠️ Failed to update .env for UserApp:", err.message);
}

// ✅ Also update DriverApp .env with same IP
const driverEnvFile = path.join(__dirname, "../TruckInn/DriverApp/.env");
try {
  const content = `EXPO_PUBLIC_BASE_URL=http://${HOST}:${PORT}\n`;
  fs.writeFileSync(driverEnvFile, content);
  console.log("🚛 .env updated for DriverApp:", content.trim());
} catch (err) {
  console.error("⚠️ Failed to update .env for DriverApp:", err.message);
}

// ✅ Start Express + Socket.io
server.listen(PORT, HOST, () => {
  console.log(`🚚 Server + Socket.io running on http://${HOST}:${PORT}`);
});

