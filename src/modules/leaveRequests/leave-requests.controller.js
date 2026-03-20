const LeaveRequest = require("./leave-request.model");
const { LEAVE_STATUS } = require("./leave-request.model");
const User = require("../users/user.model");
const { notifyUsers } = require("../notifications/notification.service");
const { success, created, badRequest, notFound } = require("../../utils/response");

const createLeaveRequest = async (req, res) => {
  try {
    const { schoolId, userId } = req.user;
    const { leaveDate, reason, studentId } = req.body;

    if (!leaveDate || !reason) {
      return badRequest(res, "leaveDate and reason are required.");
    }

    let targetStudentId = userId;
    if (studentId) {
      const student = await User.findOne({
        _id: studentId,
        schoolId,
        role: "student",
        parentId: userId,
        isActive: true
      })
        .select("_id")
        .lean();
      if (!student) {
        return badRequest(res, "studentId must belong to one of your active children.");
      }
      targetStudentId = student._id.toString();
    }

    const request = await LeaveRequest.create({
      schoolId,
      parentId: userId,
      studentId: targetStudentId,
      leaveDate: new Date(leaveDate),
      reason: String(reason).trim()
    });

    const admins = await User.find({ schoolId, role: "admin", isActive: true }).select("_id").lean();
    await notifyUsers({
      schoolId,
      userIds: admins.map((a) => a._id.toString()),
      title: "New leave request",
      message: "A parent submitted a leave request.",
      type: "LEAVE_REQUEST_CREATED",
      data: { leaveRequestId: request._id.toString(), parentId: userId }
    });

    return created(res, request, "Leave request submitted.");
  } catch (err) {
    console.error("Create leave request error:", err);
    return badRequest(res, "Failed to create leave request.");
  }
};

const myLeaveRequests = async (req, res) => {
  try {
    const { userId, schoolId } = req.user;
    const items = await LeaveRequest.find({ parentId: userId, schoolId })
      .populate("studentId", "name rollNumber")
      .sort({ createdAt: -1 })
      .lean();
    return success(res, items);
  } catch (err) {
    console.error("My leave requests error:", err);
    return badRequest(res, "Failed to fetch leave requests.");
  }
};

const cancelLeaveRequest = async (req, res) => {
  try {
    const { userId, schoolId } = req.user;
    const { id } = req.params;
    const item = await LeaveRequest.findOneAndUpdate(
      { _id: id, schoolId, parentId: userId, status: LEAVE_STATUS.PENDING },
      { $set: { status: LEAVE_STATUS.CANCELLED } },
      { new: true }
    );
    if (!item) return notFound(res, "Pending leave request not found.");
    return success(res, item, "Leave request cancelled.");
  } catch (err) {
    console.error("Cancel leave request error:", err);
    return badRequest(res, "Failed to cancel leave request.");
  }
};

const adminListLeaveRequests = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { status } = req.query;
    const filter = { schoolId };
    if (status && Object.values(LEAVE_STATUS).includes(status)) filter.status = status;

    const items = await LeaveRequest.find(filter)
      .populate("parentId", "name rollNumber phone")
      .populate("studentId", "name rollNumber")
      .populate("reviewedBy", "name")
      .sort({ createdAt: -1 })
      .lean();
    return success(res, items);
  } catch (err) {
    console.error("Admin leave list error:", err);
    return badRequest(res, "Failed to fetch leave requests.");
  }
};

const reviewLeaveRequest = async (req, res) => {
  try {
    const { schoolId, userId } = req.user;
    const { id } = req.params;
    const { status, reviewRemark } = req.body;

    if (![LEAVE_STATUS.APPROVED, LEAVE_STATUS.REJECTED].includes(status)) {
      return badRequest(res, "status must be APPROVED or REJECTED.");
    }

    const item = await LeaveRequest.findOneAndUpdate(
      { _id: id, schoolId, status: LEAVE_STATUS.PENDING },
      {
        $set: {
          status,
          reviewedBy: userId,
          reviewedAt: new Date(),
          reviewRemark: reviewRemark || null
        }
      },
      { new: true }
    );
    if (!item) return notFound(res, "Pending leave request not found.");

    await notifyUsers({
      schoolId,
      userIds: [item.parentId.toString()],
      title: "Leave request updated",
      message: `Your leave request is ${status.toLowerCase()}.`,
      type: "LEAVE_REQUEST_UPDATED",
      data: { leaveRequestId: item._id.toString(), status }
    });

    return success(res, item, "Leave request reviewed.");
  } catch (err) {
    console.error("Review leave request error:", err);
    return badRequest(res, "Failed to review leave request.");
  }
};

module.exports = {
  createLeaveRequest,
  myLeaveRequests,
  cancelLeaveRequest,
  adminListLeaveRequests,
  reviewLeaveRequest
};
