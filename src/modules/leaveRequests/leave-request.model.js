const mongoose = require("mongoose");

const LEAVE_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED"
};

const leaveRequestSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true
    },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    leaveDate: {
      type: Date,
      required: true
    },
    reason: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      enum: Object.values(LEAVE_STATUS),
      default: LEAVE_STATUS.PENDING
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    reviewedAt: {
      type: Date,
      default: null
    },
    reviewRemark: {
      type: String,
      default: null,
      trim: true
    }
  },
  { timestamps: true }
);

leaveRequestSchema.index({ schoolId: 1, status: 1, leaveDate: -1 });
leaveRequestSchema.index({ parentId: 1, leaveDate: -1 });

module.exports = mongoose.model("LeaveRequest", leaveRequestSchema);
module.exports.LEAVE_STATUS = LEAVE_STATUS;
