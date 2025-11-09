// C:\Users\MMC\Desktop\truckinn-backend\routes\userRoutes.js
const express = require("express");
const User = require("../models/User");
const mongoose = require("mongoose")
const Rating = require("../models/Rating"); // ✅ Rating model import
const router = express.Router();

// ✅ Create new user (Signup)
router.post("/", async (req, res) => {
  try {
    const { name, cnic, email, phone, password, agreed } = req.body;

    // check required fields
    if (!name || !email || !phone || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // ✅ Gmail-only validation
    if (!email.endsWith("@gmail.com")) {
      return res.status(400).json({ error: "Only Gmail addresses are allowed" });
    }

    // ✅ ensure user accepted Terms & Conditions
    if (agreed !== true) {
      return res.status(400).json({ error: "Please accept the Terms & Conditions" });
    }

    // ✅ Check if email already exists (exact match only)
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "Email already exists" });
    }

    // ✅ Check if phone already exists
    const existingPhone = await User.findOne({ phone });
   if (existingPhone) {
     return res.status(400).json({ error: "Phone number already exists" });
    }

    // create new user
    const newUser = new User({
      name,
      cnic: cnic || "-",
      email,
      phone,
      password,
      agreed,
    });

    await newUser.save();

    res.status(201).json({
      message: "User created successfully",
      user: {
        _id: newUser._id,
        name: newUser.name,
        cnic: newUser.cnic,
        email: newUser.email,
        phone: newUser.phone,
        agreed: newUser.agreed,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(400)
        .json({ error: "Duplicate entry. CNIC or Email already exists" });
    }
    res.status(500).json({ error: error.message });
  }
});


// ✅ User Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // check required fields
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // ✅ Gmail-only validation
    if (!email.endsWith("@gmail.com")) {
      return res.status(400).json({ error: "Login allowed only for Gmail users" });
    }

    // find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    // compare password
    const bcrypt = require("bcryptjs");
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    // generate token (optional JWT, can be extended later)
    const jwt = require("jsonwebtoken");
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET || "secretkey",
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        cnic: user.cnic,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ Get All Users
router.get("/", async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 }); // latest first
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});


// ✅ Get user by Phone Number with ratings
router.get("/phone/:phone", async (req, res) => {
  try {
    const user = await User.findOne({ phone: req.params.phone });
    if (!user) return res.status(404).json({ error: "User not found" });

    // rating calculate
    const ratings = await Rating.find({ givenTo: user._id, givenToModel: "User" });
    let averageRating = 0;
    if (ratings.length > 0) {
      const totalStars = ratings.reduce((sum, r) => sum + r.stars, 0);
      averageRating = (totalStars / ratings.length).toFixed(1);
    }

    res.json({
      ...user.toObject(),
      averageRating,
      totalRatings: ratings.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ✅ Delete user
router.delete("/:id", async (req, res) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.params.id);
    if (!deletedUser) return res.status(404).json({ error: "User not found" });
    res.json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
/**
 * GET /api/users/:id
 * Minimal profile for Drawer (name, phone, email)
 */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    const user = await User.findById(id).select("firstName lastName name phone email");
    if (!user) return res.status(404).json({ error: "User not found" });

    // name preference: explicit name field → else first+last
    const fullName =
      user.name ||
      `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();

    return res.json({
      _id: user._id,
      name: fullName || "User",
      phone: user.phone || "",
      email: user.email || "",
    });
  } catch (e) {
    console.error("GET /api/users/:id error:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /api/users/:id/stats
 * Minimal stats for Drawer (rating, totalRides)
 * ⤷ Abhi defaults; baad me Ride/Rating aggregation se fill karenge.
 */
router.get("/:id/stats", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    // TODO: Replace with real aggregates if/when models are ready
    // Example (jab Ride model confirm ho):
    // const totalRides = await Ride.countDocuments({ user: id });  // OR shipper: id
    // Example (jab Rating model confirm ho):
    // const agg = await Rating.aggregate([
    //   { $match: { user: new mongoose.Types.ObjectId(id) } },
    //   { $group: { _id: null, avg: { $avg: "$stars" } } },
    // ]);
    // const rating = agg[0]?.avg || 0;

    const rating = 0;       // placeholder for now
    const totalRides = 0;   // placeholder for now

    return res.json({ rating, totalRides });
  } catch (e) {
    console.error("GET /api/users/:id/stats error:", e);
    return res.status(500).json({ error: "Server error" });
  }
});
module.exports = router;
