const mongoose = require("mongoose");

const deviceTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true
    },
    token: {
      type: String,
      required: true,
      trim: true
    },
    platform: {
      type: String,
      enum: ["android", "ios", "web"],
      required: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    lastSeenAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

deviceTokenSchema.index({ userId: 1, token: 1 }, { unique: true });
deviceTokenSchema.index({ schoolId: 1, isActive: 1 });

module.exports = mongoose.model("DeviceToken", deviceTokenSchema);
