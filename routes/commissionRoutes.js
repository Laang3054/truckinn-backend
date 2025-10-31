const express = require("express");
const Commission = require("../models/Commission");

const router = express.Router();

// GET: current commission %
router.get("/", async (req, res) => {
  try {
    const doc = await Commission.getSingleton();
    res.json({ percent: doc.percent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT: update commission %
router.put("/", async (req, res) => {
  try {
    const { percent } = req.body;

    if (percent == null) {
      return res.status(400).json({ error: "percent is required" });
    }
    if (percent < 0 || percent > 100) {
      return res.status(400).json({ error: "percent must be between 0 and 100" });
    }

    const doc = await Commission.getSingleton();
    doc.percent = percent;
    await doc.save();

    res.json({ percent: doc.percent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
