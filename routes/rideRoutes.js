// C:\Users\MMC\Desktop\truckinn-backend\routes\rideRoutes.js
// --------------------------- rideRoutes.js ---------------------------

const express = require("express");
const router = express.Router();
const Bid = require("../models/Bid");
const Ride = require("../models/Ride");
const Driver = require("../models/Driver");
const Commission = require("../models/Commission");
const Notification = require("../models/Notification");
const DriverBid = require("../models/DriverBid"); // used in bid/bids routes



/* =================================================================== */
/*                              RIDES                                   */
/* =================================================================== */

/* ✅ Create new ride (updated for UserApp) */
router.post("/", async (req, res) => {
  try {
    const {
      shipperId,
      pickupLocation,
      pickupCoordinates,
      dropoffLocation,
      dropoffCoordinates,
      materialType,
      offerFare,
      vehicleCategory,
      vehicleSizeFeet,
      estimatedWeight,
      vehicleRoute,
    } = req.body;
    if (!shipperId) {
       return res.status(400).json({ error: "shipperId is required to create a ride" });
    }

    const User = require("../models/User");
    const user = await User.findById(shipperId).select("name phone");
    if (!user) {
       return res.status(404).json({ error: "User not found for given shipperId" });
    }

    // Validation
    if (
      !pickupLocation ||
      !dropoffLocation ||
      !materialType ||
      !vehicleCategory
    ) {
      return res.status(400).json({ error: "All required fields must be filled" });
    }

    // Create new ride document
    const newRide = new Ride({
      shipperId,
      shipperName: user.name,
      pickupLocation,
      pickupCoordinates,
      dropoffLocation,
      dropoffCoordinates,
      materialType,
      fareAmount: offerFare,
      vehicleCategory,
      vehicleSizeFeet,
      estimatedWeight,
      vehicleRoute,
      status: "Pending", // default for new ride
    });

    await newRide.save();
    await Notification.create({
      userId: shipperId,
      title: "Ride Created",
      message: "Your ride has been created successfully.",
      type: "ride",
    });

    const io = req.app.get("io");
    io.emit("rideCreated", { rideId: newRide._id, shipperId });

    res.status(201).json({
     message: "Ride created successfully",
     ride: {
       ...newRide.toObject(),
       shipperPhone: user.phone, // ✅ add user phone in response
      },
  });
  } catch (err) {
    console.error("Error creating ride:", err);
    res.status(500).json({ error: err.message });
  }
});
/* ✅ Get all rides */
router.get("/", async (req, res) => {
  try {
    const rides = await Ride.find()
      .populate("assignedDriver", "firstName lastName phone vehicleCategory")
      .sort({ createdAt: -1 });
    res.json(rides);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Shipper-specific rides (Pending + Completed, latest first)
router.get("/shipper/:shipperId", async (req, res) => {
  try {
    const { shipperId } = req.params;

    // fetch all rides created by this shipper
    const rides = await Ride.find({ shipperId }).sort({ createdAt: -1 });

    res.json({
      total: rides.length,
      rides,
    });
  } catch (err) {
    console.error("Error fetching shipper rides:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ✅ Available rides (match: category + size + 30 km radius) */
router.get("/available", async (req, res) => {
  try {
    const { driverId } = req.query;
    if (!driverId) {
      return res.status(400).json({ error: "driverId is required" });
    }

    // 1️⃣ Validate driver + get latest location
    const driver = await Driver.findById(driverId);
    if (!driver) return res.status(404).json({ error: "Driver not found" });

    const { currentLat, currentLng } = driver;
    if (currentLat == null || currentLng == null) {
      return res.status(400).json({ error: "Driver location not available (please go online)" });
    }

    // helper: haversine distance (km)
    const getDistanceKm = (lat1, lon1, lat2, lon2) => {
      const R = 6371;
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLon / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    // 2️⃣ Fetch rides that match category & size
    const rides = await Ride.find({
      status: "Pending",
      vehicleCategory: driver.vehicleCategory,
      vehicleSizeFeet: driver.vehicleSizeFeet,
    })
      .populate("shipperId", "name phone")
      .sort({ createdAt: -1 })
      .lean();

    // 3️⃣ Filter rides within 30 km radius of driver’s current location
    const nearbyRides = rides.filter(r => {
      const lat = r.pickupCoordinates?.lat;
      const lng = r.pickupCoordinates?.lng;
      if (typeof lat !== "number" || typeof lng !== "number") return false;
      const dist = getDistanceKm(currentLat, currentLng, lat, lng);
      return dist <= 30;
    });

    // 4️⃣ Mark driver’s own bids
    const driverBids = await DriverBid.find({ driver: driverId }).select("ride");
    const bidSet = new Set(driverBids.map(b => String(b.ride)));

    const formatted = nearbyRides.map(r => ({
      ...r,
      pickupAddress: r.pickupLocation || r.pickupCoordinates?.address || "—",
      dropoffAddress: r.dropoffLocation || r.dropoffCoordinates?.address || "—",
      driverHasBid: bidSet.has(String(r._id)),
      assignedDriverId: r.assignedDriver || null,
    }));

    // 5️⃣ Filter rides not assigned to others
    const filtered = formatted.filter(
      r => !r.assignedDriverId || String(r.assignedDriverId) === String(driverId)
    );

    res.json({
      category: driver.vehicleCategory,
      sizeFeet: driver.vehicleSizeFeet,
      total: filtered.length,
      rides: filtered,
      center: { lat: currentLat, lng: currentLng },
      radiusKm: 30,
    });
  } catch (err) {
    console.error("Error fetching available rides:", err);
    res.status(500).json({ error: err.message });
  }
});



/* ✅ Driver: current accepted ride (for DriverApp dashboard) */
router.get("/driver/:driverId/current", async (req, res) => {
  try {
    const { driverId } = req.params;

    // find the ride assigned to this driver that’s still accepted
    const ride = await Ride.findOne({
      assignedDriver: driverId,
      status: "Accepted",
    })
      .populate("assignedDriver", "firstName lastName phone vehicleCategory")
      .lean();

    if (!ride) {
      return res.status(200).json({ ride: null }); // no current ride
    }

    return res.json({ ride });
  } catch (err) {
    console.error("Error fetching current ride:", err);
    return res.status(500).json({ error: "Failed to fetch current ride" });
  }
});

/* ✅ Driver: all completed rides (for My Rides tab) */
router.get("/driver/:driverId/completed", async (req, res) => {
  try {
    const { driverId } = req.params;

    const rides = await Ride.find({
      assignedDriver: driverId,
      status: "Completed",
    })
      .sort({ updatedAt: -1 }) // latest first
      .lean();

    return res.json({ rides });
  } catch (err) {
    console.error("Error fetching completed rides:", err);
    return res.status(500).json({ error: "Failed to fetch completed rides" });
  }
});


/* ✅ Driver: all assigned rides */
router.get("/driver/:driverId/rides", async (req, res) => {
  try {
    const { driverId } = req.params;

    const rides = await Ride.find({ assignedDriver: driverId })
      .populate("assignedDriver", "firstName lastName phone vehicleCategory")
      .sort({ createdAt: -1 });

    if (!rides.length) {
      return res.status(404).json({ message: "No rides found for this driver" });
    }

    res.json(rides);
  } catch (err) {
    console.error("Error fetching driver rides:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ✅ Driver: available rides (same data as global, with driver existence check) */
router.get("/driver/:driverId/rides/available", async (req, res) => {
  try {
    const { driverId } = req.params;

    // optional sanity check
    const driver = await Driver.findById(driverId);
    if (!driver) {
      return res.status(404).json({ error: "Driver not found" });
    }

    const rides = await Ride.find({ status: "Pending" }).sort({ createdAt: -1 });
    res.json(rides);
  } catch (err) {
    console.error("Error fetching available rides for driver:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ✅ Delete ride by ID */
router.delete("/:id", async (req, res) => {
  try {
    const deletedRide = await Ride.findByIdAndDelete(req.params.id);
    if (!deletedRide) {
      return res.status(404).json({ error: "Ride not found" });
    }
    res.json({ message: "Ride deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ✅ Accept a ride by ID (generic) */
router.put("/:id/accept", async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id);
    if (!ride) return res.status(404).json({ error: "Ride not found" });

    ride.status = "Accepted";
    await ride.save();

    res.json({ message: "Ride accepted successfully", ride });
  } catch (err) {
    console.error("Error in ride acceptance:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ✅ Mark a ride as Completed (with commission calculation) */
router.put("/:id/complete", async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id);
    if (!ride) return res.status(404).json({ error: "Ride not found" });

    const commissionDoc = await Commission.findOne();
    const percent = commissionDoc ? commissionDoc.percent : 0;
    const amount = (ride.fareAmount * percent) / 100;

    ride.status = "Completed";
    ride.commissionPercent = percent;
    ride.commissionAmount = amount;

    await ride.save();

    if (ride.assignedDriver) {
      await Driver.findByIdAndUpdate(ride.assignedDriver, { isFrozen: false });
    }
    const io = req.app.get("io");
    io.emit("rideCompleted", { rideId: ride._id, status: "Completed" });

    res.json({ message: "Ride marked as completed ✅", ride });
  } catch (err) {
    console.error("Error in ride completion:", err);
    res.status(500).json({ error: err.message });
  }
});

/* =================================================================== */
/*                              BIDS                                    */
/* =================================================================== */


/* ✅ Driver submits a bid on a ride */
router.post("/:id/bid", async (req, res) => {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ error: "Empty body not allowed." });
    }
    const { id: rideId } = req.params;
    const { driverId, counterFare } = req.body;

    if (!driverId || typeof counterFare !== "number") {
      return res.status(400).json({ error: "driverId and counterFare are required" });
    }
    // 🚫 Prevent duplicate bid by same driver on same ride
    const existingBid = await DriverBid.findOne({
    ride: rideId,
    driver: driverId,
    });
    if (existingBid) {
    return res.status(400).json({
    success: false,
    message: "Duplicate bid not allowed for this ride.",
    });
    }


    const ride = await Ride.findById(rideId);
    if (!ride) return res.status(404).json({ error: "Ride not found" });

    const newBid = new DriverBid({ ride: rideId, driver: driverId, counterFare });
    await newBid.save();

    if (ride && ride.shipperId) {
      await Notification.create({
        userId: ride.shipperId,
        title: "New Bid Received",
        message: "A driver has placed a bid on your ride.",
        type: "bid",
      });
    }
    const io = req.app.get("io");
    io.emit("newBid", { rideId, driverId, bidId: newBid._id });

    res.status(201).json({ message: "Bid submitted successfully", bid: newBid });
    } catch (err) {
    console.error("Error submitting bid:", err);
    res.status(500).json({ error: err.message });
    if (!res.headersSent) {
      return res.status(200).json([]); 
  }
}
});

// ✅ Get all bids for a specific ride (with safe empty response)
router.get("/:rideId/bids", async (req, res) => {
  try {
    const { rideId } = req.params;
    const bids = await DriverBid.find({ ride: rideId })
      .populate("driver", "firstName lastName phone vehicleCategory")
      .sort({ createdAt: -1 });

    if (!bids || bids.length === 0) {
      // Instead of 404 → return empty array
      return res.json([]);
    }

    res.json(bids);
  } catch (err) {
    console.error("Error fetching bids:", err);
    res.status(500).json({ error: "Server error fetching bids" });
  }
});


// ✅ Accept a specific bid → assign driver & auto-reject others
router.put("/:rideId/bids/:bidId/accept", async (req, res) => {
  try {
    const { rideId, bidId } = req.params;

    const ride = await Ride.findById(rideId);
    if (!ride) return res.status(404).json({ error: "Ride not found" });

    const bid = await DriverBid.findById(bidId).populate("driver");
    if (!bid) return res.status(404).json({ error: "Bid not found" });

    // mark this bid accepted
    bid.status = "Accepted";
    await bid.save();

    // auto-reject all other bids for same ride
    await DriverBid.updateMany(
      { ride: rideId, _id: { $ne: bidId } },
      { $set: { status: "Rejected" } }
    );

    // update ride info
    ride.assignedDriver = bid.driver._id;
    ride.status = "Accepted"; // can be changed to "Accepted" if needed
    await ride.save();

    await Driver.findByIdAndUpdate(bid.driver._id, { isFrozen: true });

    // populate full driver info in response
    const updatedRide = await Ride.findById(rideId)
      .populate("assignedDriver")
      .lean();

    const io = req.app.get("io");

       // 🔹 Emit complete data for DriverApp realtime popup
    io.emit("bidUpdated", {
      rideId,
      bidId,
      status: "Accepted",
      driverId: bid.driver._id,        // ✅ identify target driver
      ride: updatedRide,               // ✅ full ride info for map navigation
    });

    return res.json({
      message: "Bid accepted successfully",
      ride: updatedRide,
      acceptedBid: bid,
    });
  } catch (err) {
    console.error("Error accepting bid:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ✅ Shipper rejects a specific bid (ride stays Pending)
router.put("/:rideId/bids/:bidId/reject", async (req, res) => {
  try {
    const { rideId, bidId } = req.params;

    // Bid exist?
    const bid = await DriverBid.findById(bidId);
    if (!bid) return res.status(404).json({ error: "Bid not found" });

    // Optional sanity: ensure this bid belongs to the same ride
    if (String(bid.ride) !== String(rideId)) {
      return res.status(400).json({ error: "Bid does not belong to this ride" });
    }

    // If already accepted, prevent manual reject
    if (bid.status === "Accepted") {
      return res.status(400).json({ error: "Accepted bid cannot be rejected" });
    }

    // Mark only this bid as Rejected
    bid.status = "Rejected";
    await bid.save();

    const io = req.app.get("io");
    io.emit("bidUpdated", { rideId, bidId, status: "Rejected" });

    // NOTE: Ride status intentionally unchanged (remains Pending)
    return res.json({ message: "Bid rejected successfully", bid });
  } catch (err) {
    console.error("Error rejecting bid:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ✅ Professional Bid model route (duplicate-safe, persistent)
router.post("/:rideId/bid-guarded", async (req, res) => {
  try {
    const { rideId } = req.params;
    const { driverId, counterFare, note } = req.body;

    if (!driverId || !counterFare) {
      return res.status(400).json({ ok: false, message: "driverId and counterFare are required." });
    }

    // 🚫 Guard 1: Validate ride existence and status
    const ride = await Ride.findById(rideId);
    if (!ride) return res.status(404).json({ ok: false, message: "Ride not found." });
    if (["Accepted", "Completed"].includes(ride.status)) {
      return res.status(400).json({ ok: false, message: "Ride is no longer open for bids." });
    }

    // ✅ Duplicate-safe insert
    const existing = await Bid.findOne({ rideId, driverId, status: "pending" });
    if (existing) {
      return res.status(200).json({
        ok: true,
        alreadyPlaced: true,
        message: "Pending bid already exists for this ride by this driver.",
        bidId: existing._id,
      });
    }

    const bid = await Bid.create({
      rideId,
      driverId,
      counterFare: Number(counterFare),
      note: note || "",
      status: "pending",
    });

    return res.status(200).json({
      ok: true,
      alreadyPlaced: false,
      message: "Bid placed successfully.",
      bidId: bid._id,
    });
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(200).json({
        ok: true,
        alreadyPlaced: true,
        message: "Pending bid already exists (deduplicated).",
      });
    }
    console.error("Bid-guarded route error:", err);
    return res.status(500).json({ ok: false, message: "Internal server error." });
  }
});


/* =================================================================== */
/*                             RATINGS                                  */
/* =================================================================== */

/* ✅ Add rating for a completed ride */
router.post("/:id/rate", async (req, res) => {
  try {
    const { id: rideId } = req.params;
    const { givenBy, givenByModel, givenTo, givenToModel, stars, comment } = req.body;

    if (!givenBy || !givenByModel || !givenTo || !givenToModel || !stars) {
      return res.status(400).json({ error: "All required fields must be provided" });
    }
    if (stars < 1 || stars > 5) {
      return res.status(400).json({ error: "Stars must be between 1 and 5" });
    }

    const ride = await Ride.findById(rideId);
    if (!ride) return res.status(404).json({ error: "Ride not found" });
    if (ride.status !== "Completed") {
      return res.status(400).json({ error: "Ride must be completed before rating" });
    }

    const Rating = require("../models/Rating");
    const newRating = new Rating({
      ride: rideId,
      givenBy,
      givenByModel,
      givenTo,
      givenToModel,
      stars,
      comment,
    });

    await newRating.save();
    res.status(201).json({ message: "Rating submitted successfully", rating: newRating });
  } catch (err) {
    console.error("Error submitting rating:", err);
    res.status(500).json({ error: err.message });
  }
});
// ⚠️ DEV-ONLY: fix multiple Accepted bids per ride (keep latest only)
router.post("/dev/fix-multi-accepted-bids", async (req, res) => {
  try {
    // find rides that have >1 accepted bids
    const rides = await Ride.find().select("_id assignedDriver status");
    let affectedRides = 0;
    const details = [];

    for (const ride of rides) {
      const acceptedBids = await DriverBid.find({ ride: ride._id, status: "Accepted" })
        .sort({ updatedAt: -1, createdAt: -1 })
        .populate("driver", "_id firstName lastName");

      if (acceptedBids.length > 1) {
        affectedRides++;
        const keep = acceptedBids[0];               // latest accepted
        const toReject = acceptedBids.slice(1);     // others → reject

        // reject the rest
        const rejIds = toReject.map(b => b._id);
        if (rejIds.length) {
          await DriverBid.updateMany({ _id: { $in: rejIds } }, { $set: { status: "Rejected" } });
        }

        // ensure ride points to kept driver and is Assigned
        ride.assignedDriver = keep.driver?._id || null;
        ride.status = "Accepted";
        await ride.save();

        details.push({
          rideId: String(ride._id),
          keptBidId: String(keep._id),
          rejectedCount: toReject.length,
          assignedDriver: keep.driver ? {
            _id: String(keep.driver._id),
            name: `${keep.driver.firstName || ""} ${keep.driver.lastName || ""}`.trim()
          } : null
        });
      }
    }

    return res.json({
      message: "Repair completed",
      affectedRides,
      details
    });
  } catch (err) {
    console.error("Repair error:", err);
    return res.status(500).json({ error: err.message });
  }
});
/* ✅ PATCH: update driver live location */
router.patch("/:rideId/location", async (req, res) => {
  try {
    const { rideId } = req.params;
    const { driverLat, driverLng } = req.body;

    if (
      typeof driverLat !== "number" ||
      typeof driverLng !== "number" ||
      isNaN(driverLat) ||
      isNaN(driverLng)
    ) {
      return res.status(400).json({ error: "Valid driverLat and driverLng required" });
    }

    const ride = await Ride.findById(rideId);
    if (!ride) {
      return res.status(404).json({ error: "Ride not found" });
    }

    ride.driverLat = driverLat;
    ride.driverLng = driverLng;
    ride.lastLocationUpdate = new Date();
    await ride.save();

    res.json({
      message: "Driver location updated successfully ✅",
      driverLat: ride.driverLat,
      driverLng: ride.driverLng,
      lastLocationUpdate: ride.lastLocationUpdate,
    });
  } catch (err) {
    console.error("Error updating driver location:", err);
    res.status(500).json({ error: "Failed to update driver location" });
  }
});
/* ✅ GET: fetch current driver live location */
router.get("/:rideId/location", async (req, res) => {
  try {
    const { rideId } = req.params;

    const ride = await Ride.findById(rideId).select("driverLat driverLng lastLocationUpdate assignedDriver status");
    if (!ride) {
      return res.status(404).json({ error: "Ride not found" });
    }

    // agar driver assigned ni hua to location meaningless
    if (!ride.assignedDriver) {
      return res.status(400).json({ error: "No driver assigned to this ride" });
    }

    res.json({
      rideId,
      assignedDriver: ride.assignedDriver,
      driverLat: ride.driverLat,
      driverLng: ride.driverLng,
      lastLocationUpdate: ride.lastLocationUpdate,
      status: ride.status,
    });
  } catch (err) {
    console.error("Error fetching driver location:", err);
    res.status(500).json({ error: "Failed to fetch driver location" });
  }
});


module.exports = router;
