const mongoose = require("mongoose");

const driverSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    fatherName: {
      type: String,
      required: true,
      trim: true,
    },
    cnicNumber: {
      type: String,
      required: true,
      unique: true, // ek CNIC ek hi driver ka
      trim: true,
    },
    cnicExpiryDate: {
      type: Date,
      required: true,
    },
    driverPicture: {
      type: String, // file path or URL (/uploads/drivers/..)
      required: true,
    },
    cnicFront: {
      type: String, // file path or URL
      required: true,
    },
    cnicBack: {
      type: String, // file path or URL
      required: true,
    },
    vehicleNumber: {
      type: String,
      required: true,
      unique: true, // ek vehicle ek hi driver ka
      trim: true,
    },
    vehicleDocument: {
      type: String, // file path or URL
      required: true,
    },
    licenseNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Driver", driverSchema);
