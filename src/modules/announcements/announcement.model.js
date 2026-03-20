const mongoose = require("mongoose");

const announcementSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    message: {
      type: String,
      required: true,
      trim: true
    },
    targetRoles: {
      type: [String],
      enum: ["admin", "driver", "parent"],
      default: ["parent"]
    },
    expiresAt: {
      type: Date,
      default: null
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

announcementSchema.index({ schoolId: 1, isActive: 1, createdAt: -1 });

module.exports = mongoose.model("Announcement", announcementSchema);
