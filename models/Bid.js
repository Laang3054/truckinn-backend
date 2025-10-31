// C:\Users\MMC\Desktop\truckinn-backend\models\Bid.js
const mongoose = require("mongoose");

const BidSchema = new mongoose.Schema(
  {
    rideId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ride",
      required: true,
      index: true,
    },
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      required: true,
      index: true,
    },
    counterFare: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
      index: true,
    },
    note: { type: String, default: "" },
  },
  { timestamps: true }
);

/**
 * 🔒 Unique guard for duplicate *pending* bids by same driver on same ride.
 * Uses a partial index so that only documents with status="pending" are considered.
 * This keeps history for accepted/rejected, but prevents double-pending.
 */
BidSchema.index(
  { rideId: 1, driverId: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } }
);

// Helpful read patterns
BidSchema.index({ rideId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.models.Bid || mongoose.model("Bid", BidSchema);
