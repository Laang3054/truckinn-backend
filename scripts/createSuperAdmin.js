// C:\Users\MMC\Desktop\truckinn-backend\scripts\createSuperAdmin.js
// Usage:
// 1) set MONGO_URI (see below) then run: node createSuperAdmin.js
// 2) It will create or replace a user with role "super-admin"

const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/truckinn"; // adjust if needed

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: { type: String, default: "admin" },
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.model("User", userSchema);

async function upsertSuperAdmin({ email, plainPassword, name = "Super Admin" }) {
  await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

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
  const opts = { upsert: true, new: true, setDefaultsOnInsert: true };

  const result = await User.findOneAndUpdate(filter, update, opts).lean().exec();
  console.log("Super admin upserted:", { email: result.email, role: result.role, id: result._id });
  await mongoose.disconnect();
}

(async () => {
  try {
    const email = "arslan@truckinn.app";
    const password = "123456789"; // TEMP PASSWORD — change immediately after login
    await upsertSuperAdmin({ email, plainPassword: password, name: "Arslan (Super Admin)" });
    console.log("Done. Login with the credentials and change password ASAP.");
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
})();
