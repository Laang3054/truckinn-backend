// C:\Users\MMC\Desktop\truckinn-backend\routes\vehicles.js
const express = require("express");
const Driver = require("../models/Driver");

const router = express.Router();

// Keep this list aligned with your Driver model’s enum (including "Uncategorized")
const VEHICLE_CATEGORIES = [
  "Trailer",
  "Container",
  "Dumper",
  "Flatbed",
  "Tanker",
  "Reefer",
  "Pickup",
  "MiniTruck",
  "Truck",
  "Other",
  "Uncategorized",
];

/**
 * GET /api/vehicles/stats
 * Returns totals of registered vehicles by category (aggregated from drivers).
 * Response: { stats: { [category]: number }, total: number }
 */
router.get("/stats", async (req, res) => {
  try {
    // Group by category (default to "Uncategorized" when missing)
    const agg = await Driver.aggregate([
      {
        $group: {
          _id: { $ifNull: ["$vehicleCategory", "Uncategorized"] },
          count: { $sum: 1 },
        },
      },
    ]);

    // Start with zeros for every category so UI gets all keys
    const stats = {};
    for (const c of VEHICLE_CATEGORIES) stats[c] = 0;

    let total = 0;
    for (const row of agg) {
      const key = row._id || "Uncategorized";
      stats[key] = (stats[key] || 0) + row.count;
      total += row.count;
    }

    return res.json({ stats, total });
  } catch (err) {
    console.error("❌ /api/vehicles/stats error:", err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
