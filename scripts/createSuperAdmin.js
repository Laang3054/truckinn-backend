// C:\Users\MMC\Desktop\truckinn-backend\scripts\createSuperAdmin.js
// Purpose: Upsert a Super Admin into the Admin collection (env-driven, no hardcoded URI)

require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

// IMPORTANT: server.js bhi MONGODB_URI use karta hai — yahin par bhi same env use hogi.
const MONGO_URI = process.env.MONGODB_URI;
if (!MONGO_URI) {
  console.error("MONGODB_URI missing in environment.");
  process.exit(1);
}

// NOTE: Adjust the relative path if your Admin model lives elsewhere.
const admin = require("../models/Admin"); // e.g. truckinn-backend/models/Admin.js

async function upsertSuperAdmin({ email, plainPassword, name = "Super Admin" }) {
  await mongoose.connect(MONGO_URI);

  const saltRounds = 12;
  const hashed = await bcrypt.hash(plainPassword, saltRounds);

  const filter = { email };
  const update = {
    name,
    email,
    password: hashed,
    role: "super-admin",
    updatedAt: new Date(),
  };
  const options = { upsert: true, new: true, setDefaultsOnInsert: true };

  const doc = await Admin.findOneAndUpdate(filter, update, options).lean().exec();

  console.log("✅ Super admin upserted:", {
    id: doc._id,
    email: doc.email,
    role: doc.role,
  });

  await mongoose.disconnect();
}

(async () => {
  try {
    // TODO: change these once you login successfully
    const email = "arslan@truckinn.app";
    const password = "ChangeMe@123"; // set a strong temp password
    await upsertSuperAdmin({ email, plainPassword: password, name: "Arslan (Super Admin)" });
    console.log("Done. Please change the password after first login.");
  } catch (err) {
    console.error("Seed error:", err);
    process.exit(1);
  }
})();
