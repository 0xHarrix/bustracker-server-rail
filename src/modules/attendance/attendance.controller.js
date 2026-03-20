const mongoose = require("mongoose");
const AttendanceEvent = require("./attendance-event.model");
const { success, badRequest } = require("../../utils/response");

const listAttendance = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { tripId, studentId, busId, dateFrom, dateTo, limit } = req.query;

    const filter = { schoolId };
    if (tripId && mongoose.Types.ObjectId.isValid(tripId)) filter.tripId = tripId;
    if (studentId && mongoose.Types.ObjectId.isValid(studentId)) filter.studentId = studentId;
    if (busId && mongoose.Types.ObjectId.isValid(busId)) filter.busId = busId;

    if (dateFrom || dateTo) {
      filter.actualTime = {};
      if (dateFrom) filter.actualTime.$gte = new Date(dateFrom);
      if (dateTo) filter.actualTime.$lte = new Date(dateTo);
    }

    const events = await AttendanceEvent.find(filter)
      .populate("studentId", "name rollNumber")
      .populate("busId", "busNumber")
      .populate("driverId", "name")
      .sort({ actualTime: -1 })
      .limit(Math.min(Number(limit) || 200, 1000))
      .lean();

    return success(res, events);
  } catch (err) {
    console.error("List attendance error:", err);
    return badRequest(res, "Failed to fetch attendance.");
  }
};

const myAttendance = async (req, res) => {
  try {
    const { userId, schoolId } = req.user;
    const events = await AttendanceEvent.find({ studentId: userId, schoolId })
      .populate("busId", "busNumber")
      .sort({ actualTime: -1 })
      .limit(100)
      .lean();

    return success(res, events);
  } catch (err) {
    console.error("My attendance error:", err);
    return badRequest(res, "Failed to fetch attendance.");
  }
};

module.exports = {
  listAttendance,
  myAttendance
};
