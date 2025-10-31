
const express = require("express");
const router = express.Router();

// Models
const Driver = require("../models/Driver");
const User = require("../models/User");
const Ride = require("../models/Ride");
const DriverBid = require("../models/DriverBid");
const Commission = require("../models/Commission");

// ⚠️ DEV-ONLY: wipe all data (users, drivers, rides, bids, commissions)
router.delete("/clear-all", async (req, res) => {
  try {
    const [bids, rides, drivers, users, commissions] = await Promise.all([
      DriverBid.deleteMany({}),
      Ride.deleteMany({}),
      Driver.deleteMany({}),
      User.deleteMany({}),
      Commission.deleteMany({}),
    ]);

    return res.json({
      message: "All test data deleted",
      deleted: {
        bids: bids.deletedCount,
        rides: rides.deletedCount,
        drivers: drivers.deletedCount,
        users: users.deletedCount,
        commissions: commissions.deletedCount,
      },
    });
  } catch (err) {
    console.error("DEV clear-all error:", err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;

