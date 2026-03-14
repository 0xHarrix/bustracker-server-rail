const mongoose = require("mongoose");

const schoolSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "School name is required"],
      trim: true
    },

    schoolCode: {
      type: String,
      required: [true, "School code is required"],
      unique: true,
      uppercase: true,
      trim: true,
      minlength: [2, "School code must be at least 2 characters"],
      maxlength: [20, "School code must be at most 20 characters"]
    },

    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("School", schoolSchema);
