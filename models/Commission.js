const mongoose = require("mongoose");

const CommissionSchema = new mongoose.Schema(
  {
    percent: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 0, // ✅ default 0
    },
  },
  { timestamps: true }
);

// Singleton helper: hamesha 1 hi record rahega
CommissionSchema.statics.getSingleton = async function () {
  let doc = await this.findOne();
  if (!doc) {
    doc = await this.create({ percent: 0 });
  }
  return doc;
};

module.exports = mongoose.model("Commission", CommissionSchema);
