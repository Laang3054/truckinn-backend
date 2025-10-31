// C:\Users\MMC\Desktop\truckinn-backend\models\Driver.js
const mongoose = require("mongoose");

// Allowed vehicle categories
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

// normalize function (case-insensitive)
const _catMap = VEHICLE_CATEGORIES.reduce((acc, c) => {
  acc[c.toLowerCase()] = c;
  return acc;
}, {});
const toCanonicalCategory = (v) => {
  if (v == null) return v;
  const key = String(v).trim().toLowerCase();
  return _catMap[key] || v;
};

const driverSchema = new mongoose.Schema(
  {
    // ----- Basic info -----
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    fatherName: { type: String, required: true, trim: true },

    // ----- Vendor (optional) -----
    vendorName: { type: String, trim: true, default: null },

    // ----- CNIC -----
    cnicNumber: { type: String, required: true, unique: true, trim: true },
    cnicExpiryDate: { type: Date, required: true },
    driverPicture: { type: String, required: true },
    cnicFront: { type: String, required: true },
    cnicBack: { type: String, required: true },

    // ----- Vehicle / License -----
    vehicleNumber: { type: String, required: true, unique: true, trim: true },
    vehicleDocument: { type: String, required: true },
    licenseNumber: { type: String, required: true, unique: true, trim: true },
    licenseFront: { type: String, required: true },
    licenseBack: { type: String, required: true },

    // ----- Contact -----
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },

    // ----- Vehicle Category -----
    vehicleCategory: {
      type: String,
      enum: VEHICLE_CATEGORIES,
      default: "Uncategorized",
      set: toCanonicalCategory, // normalize case
      required: true,
      trim: true,
    },

    // ----- Vehicle Size -----
    vehicleSizeFeet: {
      type: Number,
      min: 6,
      max: 180,
      default: null,
    },
  },
  { timestamps: true }
);

// Helpful indexes
driverSchema.index({ vendorName: 1 });
driverSchema.index({ vendorName: 1, vehicleCategory: 1 });

module.exports = mongoose.model("Driver", driverSchema);
