const mongoose = require("mongoose");

const stopSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    sequence: { type: Number, required: true, min: 1 },
    lat: { type: Number, required: true, min: -90, max: 90 },
    lng: { type: Number, required: true, min: -180, max: 180 },
    radiusMeters: { type: Number, default: 100, min: 10 },
    plannedPickupTime: { type: String, default: null, trim: true },
    plannedDropTime: { type: String, default: null, trim: true },
    studentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]
  },
  { _id: false }
);

const routeSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true
    },
    busId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bus",
      required: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    stops: {
      type: [stopSchema],
      default: []
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

routeSchema.index({ schoolId: 1, busId: 1 }, { unique: true });
routeSchema.index({ schoolId: 1, isActive: 1 });

module.exports = mongoose.model("Route", routeSchema);
