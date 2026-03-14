const mongoose = require("mongoose");

const TRIP_STATUS = {
  ACTIVE: "ACTIVE",
  COMPLETED: "COMPLETED"
};

const tripSchema = new mongoose.Schema(
  {
    busId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bus",
      required: [true, "Bus is required"]
    },

    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Driver is required"]
    },

    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: [true, "School is required"]
    },

    startTime: {
      type: Date,
      default: null
    },

    endTime: {
      type: Date,
      default: null
    },

    status: {
      type: String,
      enum: {
        values: [TRIP_STATUS.ACTIVE, TRIP_STATUS.COMPLETED],
        message: "Status must be ACTIVE or COMPLETED"
      },
      required: true,
      default: TRIP_STATUS.ACTIVE
    },

    // Snapshot of students assigned to this bus at trip start time.
    // This preserves the exact roster per trip — even if students
    // are reassigned to different buses between trips.
    students: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      }
    ]
  },
  { timestamps: true }
);

// ── Indexes ──────────────────────────────────────────────────────────────
// Fast lookup: active trips for a bus
tripSchema.index({ busId: 1, status: 1 });

// Fast lookup: active trips in a school
tripSchema.index({ schoolId: 1, status: 1 });

// ── RACE CONDITION PROTECTION ────────────────────────────────────────────
// Only ONE active trip per bus at the DB level.
// This is a unique partial index: it only enforces uniqueness for
// documents where status = "ACTIVE". Multiple COMPLETED trips per bus
// are fine.
tripSchema.index(
  { busId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "ACTIVE" }
  }
);

module.exports = mongoose.model("Trip", tripSchema);
module.exports.TRIP_STATUS = TRIP_STATUS;
