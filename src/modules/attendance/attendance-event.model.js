const mongoose = require("mongoose");

const ATTENDANCE_EVENT_TYPE = {
  PICKED_UP: "PICKED_UP",
  DROPPED: "DROPPED"
};

const attendanceEventSchema = new mongoose.Schema(
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
    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Trip",
      required: true
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    eventType: {
      type: String,
      enum: Object.values(ATTENDANCE_EVENT_TYPE),
      required: true
    },
    stopName: {
      type: String,
      default: null,
      trim: true
    },
    stopSequence: {
      type: Number,
      default: null
    },
    actualTime: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

attendanceEventSchema.index({ schoolId: 1, actualTime: -1 });
attendanceEventSchema.index({ tripId: 1, studentId: 1, eventType: 1, actualTime: -1 });
attendanceEventSchema.index({ studentId: 1, actualTime: -1 });

module.exports = mongoose.model("AttendanceEvent", attendanceEventSchema);
module.exports.ATTENDANCE_EVENT_TYPE = ATTENDANCE_EVENT_TYPE;
