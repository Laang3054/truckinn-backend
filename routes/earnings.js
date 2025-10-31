// C:\Users\MMC\Desktop\truckinn-backend\routes\earnings.js

const express = require("express");
const router = express.Router();
const Ride = require("../models/Ride");

/* ✅ GET /api/earnings/summary
   Returns total completed rides, total fare, and total commission earned */
router.get("/summary", async (req, res) => {
  try {
    const completedRides = await Ride.find({ status: "Completed" });

    const totalFare = completedRides.reduce((sum, r) => sum + (r.fareAmount || 0), 0);
    const totalCommission = completedRides.reduce(
      (sum, r) => sum + (r.commissionAmount || 0),
      0
    );
    const commissionPercent = completedRides.length
      ? completedRides[0].commissionPercent
      : null;

    res.json({
      completedRides: completedRides.length,
      totalFare,
      totalCommission,
      commissionPercent,
    });
  } catch (err) {
    console.error("Error fetching earnings summary:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
