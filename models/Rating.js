// C:\Users\MMC\Desktop\truckinn-backend\models\Rating.js

const mongoose = require("mongoose");

const ratingSchema = new mongoose.Schema(
  {
    ride: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ride",
      required: true,
    },
    givenBy: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "givenByModel", // dynamic reference (Driver ya User dono ho sakta)
      required: true,
    },
    givenByModel: {
      type: String,
      enum: ["Driver", "User"], // kisne rating di
      required: true,
    },
    givenTo: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "givenToModel",
      required: true,
    },
    givenToModel: {
      type: String,
      enum: ["Driver", "User"], // kisko rating mili
      required: true,
    },
    stars: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    comment: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Rating", ratingSchema);
