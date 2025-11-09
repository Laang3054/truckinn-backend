// C:\Users\MMC\Desktop\truckinn-backend\routes\driverRoutes.js
const Rating = require("../models/Rating"); 
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Driver = require("../models/Driver");
const Ride = require("../models/Ride"); // ✅ Added missing import

const router = express.Router();

/* ========== Storage Setup ========== */
const uploadsBase = path.join(__dirname, "..", "uploads");
const driversDir = path.join(uploadsBase, "drivers");
if (!fs.existsSync(driversDir)) {
  fs.mkdirSync(driversDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, driversDir);
  },
  filename: function (req, file, cb) {
    const ts = Date.now();
    const ext = path.extname(file.originalname || "");
    cb(null, `${file.fieldname}-${ts}${ext}`);
  },
});
const upload = multer({ storage });

/* Helper: normalize path */
const webPath = (absPath) => {
  const rel = absPath.split("uploads").pop();
  return `/uploads${rel.replace(/\\/g, "/")}`;
};

/* ========== CREATE DRIVER (with vendorName optional) ========== */
router.post(
  "/",
  upload.fields([
    { name: "driverPicture", maxCount: 1 },
    { name: "cnicFront", maxCount: 1 },
    { name: "cnicBack", maxCount: 1 },
    { name: "vehicleDocument", maxCount: 1 },
    { name: "licenseFront", maxCount: 1 },
    { name: "licenseBack", maxCount: 1 },
  ]),
  async (req, res, next) => {
    try {
      const {
        firstName,
        lastName,
        fatherName,
        vendorName,
        cnicNumber,
        cnicExpiryDate,
        vehicleNumber,
        licenseNumber,
        email,
        phone,
        vehicleCategory,
        vehicleSizeFeet,
      } = req.body;

      const missing = [];
      if (!firstName) missing.push("firstName");
      if (!lastName) missing.push("lastName");
      if (!fatherName) missing.push("fatherName");
      if (!cnicNumber) missing.push("cnicNumber");
      if (!cnicExpiryDate) missing.push("cnicExpiryDate");
      if (!vehicleNumber) missing.push("vehicleNumber");
      if (!licenseNumber) missing.push("licenseNumber (Driving License)");
      if (!email) missing.push("email");
      if (!phone) missing.push("phone");
      if (!req.files?.driverPicture) missing.push("driverPicture(file)");
      if (!req.files?.licenseFront) missing.push("licenseFront(file)");
      if (!req.files?.licenseBack) missing.push("licenseBack(file)");
      if (!req.files?.cnicFront) missing.push("cnicFront(file)");
      if (!req.files?.cnicBack) missing.push("cnicBack(file)");
      if (!req.files?.vehicleDocument) missing.push("vehicleDocument(file)");

      if (missing.length) {
        return res
          .status(400)
          .json({ error: `Missing required: ${missing.join(", ")}` });
      }

      const normalizedCNIC = String(cnicNumber).replace(/\s+/g, "");

      const existing = await Driver.findOne({
        $or: [
          { cnicNumber: normalizedCNIC },
          { vehicleNumber },
          { licenseNumber },
          { email: email.toLowerCase() },
          { phone },
        ],
      }).lean();

      if (existing) {
        return res.status(400).json({
          error:
            "Driver already exists with same CNIC, Vehicle Number, License, Email, or Phone",
        });
      }

      const driver = new Driver({
        firstName,
        lastName,
        fatherName,
        vendorName: vendorName || null,
        cnicNumber: normalizedCNIC,
        cnicExpiryDate,
        vehicleNumber,
        licenseNumber,
        email: String(email).toLowerCase().trim(),
        phone,
        driverPicture: webPath(req.files["driverPicture"][0].path),
        cnicFront: webPath(req.files["cnicFront"][0].path),
        cnicBack: webPath(req.files["cnicBack"][0].path),
        licenseFront: webPath(req.files["licenseFront"][0].path),
        licenseBack: webPath(req.files["licenseBack"][0].path),
        vehicleDocument: webPath(req.files["vehicleDocument"][0].path),
        vehicleCategory: vehicleCategory?.trim() || undefined,
        vehicleSizeFeet: vehicleSizeFeet ? Number(vehicleSizeFeet) : undefined,
      });

      await driver.save();
      return res.status(201).json({
        message: "Driver added successfully",
        driver,
      });
    } catch (err) {
      next(err);
    }
  }
);

/* ✅ Get all drivers with rating info */
router.get("/", async (req, res) => {
  try {
    const drivers = await Driver.find();

    const driverData = await Promise.all(
      drivers.map(async (driver) => {
        const ratings = await Rating.find({ givenTo: driver._id, givenToModel: "Driver" });

        let averageRating = 0;
        if (ratings.length > 0) {
          const totalStars = ratings.reduce((sum, r) => sum + r.stars, 0);
          averageRating = (totalStars / ratings.length).toFixed(1);
        }

        return {
          ...driver.toObject(),
          averageRating,
          totalRatings: ratings.length,
        };
      })
    );

    res.json(driverData);
  } catch (err) {
    console.error("Error fetching drivers:", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Get driver by CNIC with ratings 
router.get("/search/:cnic", async (req, res) => {
  try {
    const driver = await Driver.findOne({ cnicNumber: req.params.cnic });
    if (!driver) return res.status(404).json({ error: "Driver not found" });

    const ratings = await Rating.find({ givenTo: driver._id, givenToModel: "Driver" });
    let averageRating = 0;
    if (ratings.length > 0) {
      const totalStars = ratings.reduce((sum, r) => sum + r.stars, 0);
      averageRating = (totalStars / ratings.length).toFixed(1);
    }

    res.json({
      ...driver.toObject(),
      averageRating,
      totalRatings: ratings.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ========== GET DRIVERS BY VENDOR NAME ========== */
router.get("/vendor/:vendorName", async (req, res, next) => {
  try {
    const vendor = req.params.vendorName;
    const drivers = await Driver.find({
      vendorName: { $regex: new RegExp(`^${vendor}$`, "i") },
    }).lean();

    if (!drivers.length) {
      return res
        .status(404)
        .json({ error: "No drivers found for this vendor" });
    }

    return res.json({ vendorName: vendor, drivers });
  } catch (err) {
    next(err);
  }
});

/* ========== DELETE DRIVER BY ID ========== */
router.delete("/:id", async (req, res, next) => {
  try {
    const deleted = await Driver.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Driver not found" });
    }
    return res.json({ message: "Driver deleted successfully" });
  } catch (err) {
    next(err);
  }
});

/* ========== UPDATE DRIVER BY ID ========== */
router.put(
  "/:id",
  upload.fields([
    { name: "driverPicture", maxCount: 1 },
    { name: "cnicFront", maxCount: 1 },
    { name: "cnicBack", maxCount: 1 },
    { name: "vehicleDocument", maxCount: 1 },
  ]),
  async (req, res, next) => {
    try {
      const {
        vendorName,
        firstName,
        lastName,
        fatherName,
        cnicExpiryDate,
        vehicleNumber,
        licenseNumber,
        email,
        phone,
        vehicleCategory,
        vehicleSizeFeet,
      } = req.body;

      const update = {};
      if (vendorName !== undefined) update.vendorName = vendorName || null;
      if (firstName !== undefined) update.firstName = firstName;
      if (lastName !== undefined) update.lastName = lastName;
      if (fatherName !== undefined) update.fatherName = fatherName;
      if (cnicExpiryDate !== undefined) update.cnicExpiryDate = cnicExpiryDate;
      if (vehicleNumber !== undefined) update.vehicleNumber = vehicleNumber;
      if (licenseNumber !== undefined) update.licenseNumber = licenseNumber;
      if (email !== undefined) update.email = String(email).toLowerCase().trim();
      if (phone !== undefined) update.phone = phone;
      if (vehicleCategory !== undefined)
        update.vehicleCategory = vehicleCategory?.trim() || undefined;
      if (vehicleSizeFeet !== undefined)
      update.vehicleSizeFeet = vehicleSizeFeet ? Number(vehicleSizeFeet) : undefined;
      
      

      const driver = await Driver.findById(req.params.id);
      if (!driver) {
        return res.status(404).json({ error: "Driver not found" });
      }

      const maybeReplaceFile = (field) => {
        if (req.files?.[field]) {
          const newPath = `uploads/${req.files[field][0].filename}`;
          if (driver[field]) {
            try {
              const abs = path.join(__dirname, "..", driver[field]);
              fs.unlink(abs, () => {});
            } catch (e) {}
          }
          update[field] = newPath;
        }
      };
      
      maybeReplaceFile("driverPicture");
      maybeReplaceFile("cnicFront");
      maybeReplaceFile("cnicBack");
      maybeReplaceFile("vehicleDocument");

      const updated = await Driver.findByIdAndUpdate(
        req.params.id,
        { $set: update },
        { new: true, runValidators: true }
      );

      return res.json({ message: "Driver updated successfully", driver: updated });
    } catch (err) {
      if (err && err.code === 11000) {
        return res.status(400).json({
          error: "Duplicate value for unique field (email/phone/license/vehicle)",
        });
      }
      next(err);
    }
  }
);

/* ✅ Accept a ride by ID */
router.put("/:id/accept", async (req, res) => {
  try {
    const rideId = req.params.id;

    const ride = await Ride.findById(rideId);
     if (!ride) {
      return res.status(404).json({ error: "Ride not found" });
    }

    // ✅ assign driver ID from param or body
    const { driverId } = req.body;
     if (driverId) ride.assignedDriver = driverId;

    // ✅ update status
    ride.status = "Accepted";
     await ride.save();

     // ✅ auto-reject other Pending rides by same driver (one active rule)
     await Ride.updateMany(
     { assignedDriver: driverId, _id: { $ne: ride._id }, status: "Pending" },
     { $set: { status: "Rejected" } }
    );

    res.json({ message: "Ride accepted successfully", ride });

    } catch (err) {
    console.error("Error in ride acceptance:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ✅ Update driver online/offline status */
router.put("/:id/status", async (req, res) => {
  try {
    const { online } = req.body; // expecting true or false
    if (online === undefined) {
      return res.status(400).json({ error: "Missing field: online" });
    }

    const driver = await Driver.findByIdAndUpdate(
      req.params.id,
      { $set: { online } },
      { new: true }
    );

    if (!driver) {
      return res.status(404).json({ error: "Driver not found" });
    }

    res.json({
      message: `Driver is now ${online ? "Online" : "Offline"}`,
      driverId: driver._id,
      online: driver.online,
    });
  } catch (err) {
    console.error("Error updating driver status:", err);
    res.status(500).json({ error: err.message });
  }
});


/* ✅ Driver login via phone number */
router.post("/login", async (req, res) => {
  try {
    const { phone } = req.body;
    console.log("📞 Incoming phone from app:", phone);

    if (!phone) {
      return res.status(400).json({ error: "Phone number required" });
    }

    const cleanPhone = phone.trim();
    console.log("🔍 Cleaned phone:", cleanPhone);

    const allDrivers = await Driver.find({}, { phone: 1 });
    console.log("📋 All registered phones:", allDrivers.map(d => d.phone));

    const driver = await Driver.findOne({ phone: cleanPhone });
    if (!driver) {
      return res.status(404).json({ error: "No account found for this phone number" });
    }

    res.json({
      message: "OTP sent successfully (dummy)",
      driverId: driver._id,
    });
  } catch (error) {
    console.error("❌ Error in driver login:", error);
    res.status(500).json({ error: error.message });
  }
});



/* GET: list drivers by vendor name (case-insensitive) */
router.get("/by-vendor/:vendor", async (req, res, next) => {
  try {
    const vendor = decodeURIComponent(req.params.vendor || "").trim();
    if (!vendor) return res.status(400).json({ error: "Vendor name required" });

    const regex = new RegExp(vendor.replace(/\s+/g, "\\s*"), "i");

    const drivers = await Driver.find({ vendorName: { $regex: regex } })
      .select("firstName lastName fatherName cnicNumber phone email vehicleNumber licenseNumber vendorName");

    return res.json(drivers);
  } catch (err) {
    next(err);
  }
});

 /* ✅ Driver: all assigned rides (updated for new schema) */
 router.get("/:driverId/rides", async (req, res) => {
   try {
     const { driverId } = req.params;

     const rides = await Ride.find({ assignedDriver: driverId })
       .populate("assignedDriver", "firstName lastName phone vehicleCategory vehicleSizeFeet")
       .populate("shipperId", "name phone")
       .sort({ createdAt: -1 })
       .lean();

     const formatted = rides.map(r => ({
       ...r,
       pickupAddress: r.pickupLocation || r.pickupCoordinates?.address || "—",
       dropoffAddress: r.dropoffLocation || r.dropoffCoordinates?.address || "—",
    }));

   res.json(formatted);
  } catch (err) {
    console.error("Error fetching driver rides:", err);
    res.status(500).json({ error: err.message });
  }
});


 /* ✅ Get driver by ID (with rating + friendly fields) */
 router.get("/:id", async (req, res) => {
   try {
     const driver = await Driver.findById(req.params.id);
     if (!driver) return res.status(404).json({ error: "Driver not found" });

     const ratings = await Rating.find({ givenTo: driver._id, givenToModel: "Driver" });
     let averageRating = 0;
     if (ratings.length > 0) {
       const totalStars = ratings.reduce((sum, r) => sum + r.stars, 0);
       averageRating = Number((totalStars / ratings.length).toFixed(2));
     }

     const fullName = `${driver.firstName ?? ""} ${driver.lastName ?? ""}`.trim() || "Driver";
     return res.json({
       ...driver.toObject(),
       name: fullName,
       rating: averageRating,
       reviews: ratings.length,
       isFrozen: driver.isFrozen || false,
     });
   } catch (err) {
     return res.status(500).json({ error: err.message });
  }
});

/* ✅ Driver: all completed rides (aligned with UserApp schema) */
router.get("/:driverId/completed", async (req, res) => {
  try {
    const { driverId } = req.params;

    const rides = await Ride.find({
      assignedDriver: driverId,
      status: "Completed",
    })
      .populate("shipperId", "name phone")
      .populate("assignedDriver", "firstName lastName phone vehicleCategory vehicleSizeFeet")
      .sort({ updatedAt: -1 })
      .lean();

    const formatted = rides.map(r => ({
      ...r,
      pickupAddress: r.pickupLocation || r.pickupCoordinates?.address || "—",
      dropoffAddress: r.dropoffLocation || r.dropoffCoordinates?.address || "—",
    }));

    res.json({
      total: formatted.length,
      rides: formatted,
    });
  } catch (err) {
    console.error("Error fetching completed rides:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ✅ PATCH: update driver live location */
router.patch("/:driverId/location", async (req, res) => {
  try {
    const { driverId } = req.params;
    const { lat, lng, accuracy, speed, heading } = req.body;

    // basic validation
    if (
      typeof lat !== "number" ||
      typeof lng !== "number" ||
      isNaN(lat) ||
      isNaN(lng)
    ) {
      return res.status(400).json({ error: "Valid lat & lng required" });
    }

    const driver = await Driver.findById(driverId);
    if (!driver) {
      return res.status(404).json({ error: "Driver not found" });
    }

    driver.currentLat = lat;
    driver.currentLng = lng;
    driver.lastLocationUpdate = new Date();
    await driver.save();

    try {
      const io = req.app.get("io");  // ✅ get socket instance from Express
       io.emit("driverLocationUpdate", {
       driverId,
       lat: driver.currentLat,
       lng: driver.currentLng,
       lastLocationUpdate: driver.lastLocationUpdate,
      });
     console.log("📡 Emitted driverLocationUpdate:", driverId, driver.currentLat, driver.currentLng);
      } catch (socketErr) {
     console.error("⚠️ Socket emit failed:", socketErr.message);
    }


    res.json({
      message: "Driver live location updated ✅",
      driverId,
      currentLat: driver.currentLat,
      currentLng: driver.currentLng,
      lastLocationUpdate: driver.lastLocationUpdate,
    });
  } catch (err) {
    console.error("❌ Error updating driver location:", err);
    res.status(500).json({ error: "Failed to update driver location" });
  }
});



module.exports = router;
