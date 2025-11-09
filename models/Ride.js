// C:\Users\MMC\Desktop\truckinn-backend\models\Ride.js

const mongoose = require("mongoose");

// 🔹 Bid subSchema
const bidSchema = new mongoose.Schema(
  {
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      required: true,
    },
    counterFare: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ["Pending", "Accepted", "Rejected"],
      default: "Pending",
    },
  },
  { timestamps: true }
);

const rideSchema = new mongoose.Schema(
  {
    shipperId: {
     type: mongoose.Schema.Types.ObjectId,
     ref: "User",
     required: true,
    },
    shipperName: {
      type: String,
      required: true,
      trim: true,
    },
    pickupLocation: {
      type: String,
      required: true,
      trim: true,
    },
    pickupCoordinates: {
      lat: { type: Number },
      lng: { type: Number },
    },
    dropoffLocation: {
      type: String,
      required: true,
      trim: true,
    },
    dropoffCoordinates: {
      lat: { type: Number },
      lng: { type: Number },
    },
    materialType: {
      type: String,
      required: true,
      trim: true, 
    },
    fareAmount: {
      type: Number,
      required: true,
      min: 0, 
    },
    vehicleCategory: {
      type: String,
      required: true,
      trim: true,
    },
    vehicleSizeFeet: {
     type: String, 
     default: null,
     trim: true,
    },
    estimatedWeight: { 
      type: String 
    },
    vehicleRoute: { 
      type: String, enum: ["Standard", "Express"], 
      default: "Standard" 
    },
    assignedDriver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      default: null,
    },
    status: {
      type: String,
      enum: ["Pending", "Accepted", "Ongoing", "Completed"],
      default: "Pending",
    },
    commissionPercent: { type: Number, default: 0 },
    commissionAmount: { type: Number, default: 0 },

    // 🔹 New field: bids array
    bids: [bidSchema],
  },
  { timestamps: true }
);
// 🔹 Driver live tracking fields
rideSchema.add({
  driverLat: {
    type: Number,
    default: null,
  },
  driverLng: {
    type: Number,
    default: null,
  },
  lastLocationUpdate: {
    type: Date,
    default: null,
  },
});


module.exports = mongoose.model("Ride", rideSchema);
