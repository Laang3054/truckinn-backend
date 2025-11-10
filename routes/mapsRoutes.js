// 📁 C:\Users\MMC\Desktop\truckinn-backend\routes\mapsRoutes.js

const express = require("express");
const router = express.Router();
const axios = require("axios");

// 🔹 Reverse Geocode: lat/lng → address
router.get("/reverse", async (req, res) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ error: "Missing latitude or longitude" });
    }

    const apiKey = process.env.GOOGLE_MAPS_SERVER_KEY;
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;

    const response = await axios.get(url);

    if (response.data.status === "OK") {
      const address = response.data.results[0]?.formatted_address || "Unknown location";
      return res.json({ address });
    } else {
      return res.status(400).json({
        error: "Geocoding failed",
        details: response.data.status,
      });
    }
  } catch (error) {
    console.error("Reverse geocode error:", error.message);
    res.status(500).json({ error: "Server error", details: error.message });
  }
});

module.exports = router;
