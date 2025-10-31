// C:\Users\MMC\Desktop\truckinn-backend\routes\ratingRoutes.js

const express = require("express");
const Rating = require("../models/Rating");

const router = express.Router();
/* ✅ Create new rating */
router.post("/", async (req, res) => {
  try {
    const { ride, givenBy, givenByModel, givenTo, givenToModel, stars, comment } = req.body;

    if (!ride || !givenBy || !givenByModel || !givenTo || !givenToModel || !stars) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const rating = await Rating.create({
      ride,
      givenBy,
      givenByModel,
      givenTo,
      givenToModel,
      stars,
      comment,
    });

    res.status(201).json({ message: "Rating created successfully", rating });
  } catch (err) {
    console.error("Error creating rating:", err);
    res.status(500).json({ error: err.message });
  }
});
/* ✅ Add a new rating */
router.post("/", async (req, res) => {
  try {
    const { givenBy, givenTo, givenToModel, stars, comment } = req.body;

    if (!givenBy || !givenTo || !givenToModel || !stars) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const newRating = new Rating({
      givenBy,
      givenTo,
      givenToModel, // "Driver" ya "User"
      stars,
      comment,
    });

    await newRating.save();
    res.status(201).json({ message: "Rating created successfully", rating: newRating });
  } catch (err) {
    console.error("Error creating rating:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ✅ Get all ratings for a driver (with average + count) */
router.get("/driver/:id", async (req, res) => {
  try {
    const driverId = req.params.id;

    const ratings = await Rating.find({ givenTo: driverId, givenToModel: "Driver" })
      .populate("givenBy", "name email phone")
      .sort({ createdAt: -1 });

    if (!ratings.length) {
      return res.status(404).json({ error: "No ratings found for this driver" });
    }

    const totalRatings = ratings.length;
    const averageRating =
      ratings.reduce((sum, r) => sum + r.stars, 0) / totalRatings;

    res.json({
      totalRatings,
      averageRating: averageRating.toFixed(1),
      ratings,
    });
  } catch (err) {
    console.error("Error fetching driver ratings:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ✅ Get all ratings for a user (shipper) with average + count */
router.get("/user/:id", async (req, res) => {
  try {
    const userId = req.params.id;

    const ratings = await Rating.find({ givenTo: userId, givenToModel: "User" })
      .populate("givenBy", "firstName lastName phone")
      .sort({ createdAt: -1 });

    if (!ratings.length) {
      return res.status(404).json({ error: "No ratings found for this user" });
    }

    const totalRatings = ratings.length;
    const averageRating =
      ratings.reduce((sum, r) => sum + r.stars, 0) / totalRatings;

    res.json({
      totalRatings,
      averageRating: averageRating.toFixed(1),
      ratings,
    });
  } catch (err) {
    console.error("Error fetching user ratings:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
