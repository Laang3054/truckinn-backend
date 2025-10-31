// C:\Users\MMC\Desktop\truckinn-backend\routes\drivers.js
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const Driver = require("../models/Driver");

const router = express.Router();

/* ---------------- Helpers ---------------- */
const VEHICLE_CATEGORIES = [
  "Trailer", "Container", "Dumper", "Flatbed", "Tanker",
  "Reefer", "Pickup", "MiniTruck", "Truck", "Other",
];

// normalize helper
function normalizeCategory(v) {
  if (!v) return null;
  const found = VEHICLE_CATEGORIES.find(
    (c) => c.toLowerCase() === v.trim().toLowerCase()
  );
  return found || null;
}

// ensure uploads/drivers dir exists
const baseUploadDir = path.join(__dirname, "..", "uploads", "drivers");
fs.mkdirSync(baseUploadDir, { recursive: true });

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, baseUploadDir),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}_${safe}`);
  },
});
const upload = multer({ storage });

// Convert absolute path → web path (/uploads/…)
const webPath = (absPath) =>
  "/" + String(absPath).replace(/\\/g, "/").replace(/^.*?uploads\//, "uploads/");

/* ---------------- Routes ---------------- */

/**
 * CREATE driver (multipart/form-data)
 */
router.post(
  "/",
  upload.any(),
  async (req, res) => {
    try {
      const {
        vendorName,
        firstName,
        lastName,
        fatherName,
        cnicNumber,
        cnicExpiryDate,
        vehicleNumber,
        licenseNumber,
        email,
        phone,
        vehicleCategory,
        vehicleSizeFeet,
      } = req.body;

      // required text fields
      if (
        !firstName || !lastName || !fatherName ||
        !cnicNumber || !cnicExpiryDate ||
        !vehicleNumber || !licenseNumber ||
        !email || !phone
      ) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // map files by fieldname
      const byName = {};
      for (const f of req.files || []) byName[f.fieldname] = f;

      const driverPictureFile = byName["driverPicture"] || byName["picture"];
      const cnicFrontFile     = byName["cnicFront"] || byName["cnic_front"];
      const cnicBackFile      = byName["cnicBack"]  || byName["cnic_back"];
      const vehicleDocFile    = byName["vehicleDocument"] || byName["vehicleDoc"] || byName["vehicle_document"];

      if (!driverPictureFile || !cnicFrontFile || !cnicBackFile || !vehicleDocFile) {
        return res.status(400).json({
          error: "All four files are required: driverPicture, cnicFront, cnicBack, vehicleDocument",
        });
      }

      // vehicleCategory normalize
      let categoryToSave = "Uncategorized";
      if (vehicleCategory && vehicleCategory !== "") {
        const normalized = normalizeCategory(vehicleCategory);
        if (!normalized) {
          return res.status(400).json({
            error: "Invalid vehicleCategory. Allowed: " + VEHICLE_CATEGORIES.join(", "),
          });
        }
        categoryToSave = normalized;
      }

      // vehicleSizeFeet validate
      let sizeFeet = null;
      if (vehicleSizeFeet !== undefined && vehicleSizeFeet !== "") {
        const n = Number(vehicleSizeFeet);
        if (!Number.isFinite(n) || n < 6 || n > 60) {
          return res.status(400).json({ error: "vehicleSizeFeet must be between 6 and 60 (feet)" });
        }
        sizeFeet = n;
      }

      const doc = await Driver.create({
        vendorName: vendorName ?? null,
        firstName, lastName, fatherName,
        cnicNumber,
        cnicExpiryDate: new Date(cnicExpiryDate),
        driverPicture: webPath(driverPictureFile.path),
        cnicFront:     webPath(cnicFrontFile.path),
        cnicBack:      webPath(cnicBackFile.path),
        vehicleNumber,
        vehicleDocument: webPath(vehicleDocFile.path),
        licenseNumber,
        email: String(email).toLowerCase().trim(),
        phone,
        vehicleCategory: categoryToSave,   // ✅ always assigned
        vehicleSizeFeet: sizeFeet,         // ✅ optional
      });

      return res.status(201).json({ message: "Driver added successfully", driver: doc });
    } catch (error) {
      if (error && error.code === 11000) {
        return res.status(400).json({
          error: "Duplicate value for unique field (cnicNumber/email/phone/licenseNumber/vehicleNumber)",
        });
      }
      return res.status(500).json({ error: error.message });
    }
  }
);

// GET all drivers
router.get("/", async (req, res) => {
  try {
    const drivers = await Driver.find().lean();
    res.json(drivers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/drivers/phone/:phone
router.get("/phone/:phone", async (req, res) => {
  try {
    const driver = await Driver.findOne({ phone: req.params.phone });
    if (!driver) {
      return res.status(404).json({ message: "Driver not found" });
    }
    res.json(driver); // ✅ pura object bhej do
  } catch (err) {
    console.error("Error fetching driver by phone:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET single driver
router.get("/:id", async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.id).lean();
    if (!driver) return res.status(404).json({ error: "Driver not found" });
    res.json(driver);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE driver
router.delete("/:id", async (req, res) => {
  try {
    const deletedDriver = await Driver.findByIdAndDelete(req.params.id);
    if (!deletedDriver) return res.status(404).json({ error: "Driver not found" });
    res.json({ message: "Driver deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// GET drivers by vendor name (case-insensitive)
router.get("/by-vendor/:vendor", async (req, res) => {
  try {
    const vendorName = req.params.vendor.trim();
    const drivers = await Driver.find({
      vendorName: { $regex: new RegExp("^" + vendorName + "$", "i") },
    }).lean();

    res.json(drivers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// GET driver by CNIC (search)
router.get("/search/:cnic", async (req, res) => {
  try {
    const driver = await Driver.findOne({ cnicNumber: req.params.cnic }).lean();
    if (!driver) {
      return res.status(404).json({ error: "Driver not found" });
    }
    res.json(driver);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
