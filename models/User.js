const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");


const userSchema = new mongoose.Schema(

  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    cnic: {
      type: String,
      required: false,
      trim: true,
      unique: true,
      default: "-",
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,   
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    agreed: {
     type: Boolean,
     default: false,
    },

  },
  { timestamps: true }
);
// ✅ Hash password before save
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model("User", userSchema);
