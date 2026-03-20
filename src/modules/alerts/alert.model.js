const mongoose = require("mongoose");

const ALERT_TYPE = {
  SOS: "SOS",
  EMERGENCY_BROADCAST: "EMERGENCY_BROADCAST"
};

const ALERT_STATUS = {
  ACTIVE: "ACTIVE",
  RESOLVED: "RESOLVED"
};

const alertSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true
    },
    busId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bus",
      default: null
    },
    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Trip",
      default: null
    },
    type: {
      type: String,
      enum: Object.values(ALERT_TYPE),
      required: true
    },
    severity: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      default: "HIGH"
    },
    message: {
      type: String,
      required: true,
      trim: true
    },
    raisedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    status: {
      type: String,
      enum: Object.values(ALERT_STATUS),
      default: ALERT_STATUS.ACTIVE
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    resolvedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

alertSchema.index({ schoolId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("Alert", alertSchema);
module.exports.ALERT_TYPE = ALERT_TYPE;
module.exports.ALERT_STATUS = ALERT_STATUS;
