const mongoose = require("mongoose");

const busSchema = new mongoose.Schema(
  {
    busNumber: {
      type: String,
      required: [true, "Bus number is required"],
      trim: true
    },

    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: [true, "School is required"]
    },

    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    capacity: {
      type: Number,
      default: null,
      min: [1, "Capacity must be at least 1"]
    },

    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

// ── Indexes ──────────────────────────────────────────────────────────────
// Fast lookup by school
busSchema.index({ schoolId: 1 });

// Bus number must be unique within a school
busSchema.index({ schoolId: 1, busNumber: 1 }, { unique: true });

// Fast lookup by driver (for "is this driver already assigned?")
busSchema.index(
  { driverId: 1 },
  { sparse: true, partialFilterExpression: { driverId: { $ne: null } } }
);

module.exports = mongoose.model("Bus", busSchema);
