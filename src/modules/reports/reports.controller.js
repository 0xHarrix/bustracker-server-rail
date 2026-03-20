const AttendanceEvent = require("../attendance/attendance-event.model");
const Route = require("../routes/route.model");
const { success, badRequest } = require("../../utils/response");

const toMinutesFromMidnight = (timeString) => {
  if (!timeString || typeof timeString !== "string") return null;
  const [hh, mm] = timeString.split(":").map(Number);
  if (!Number.isInteger(hh) || !Number.isInteger(mm)) return null;
  return hh * 60 + mm;
};

const getPickupDropTimingReport = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { dateFrom, dateTo, busId, studentId } = req.query;

    const filter = { schoolId };
    if (busId) filter.busId = busId;
    if (studentId) filter.studentId = studentId;
    if (dateFrom || dateTo) {
      filter.actualTime = {};
      if (dateFrom) filter.actualTime.$gte = new Date(dateFrom);
      if (dateTo) filter.actualTime.$lte = new Date(dateTo);
    }

    const events = await AttendanceEvent.find(filter)
      .populate("studentId", "name rollNumber")
      .populate("busId", "busNumber")
      .sort({ actualTime: -1 })
      .lean();

    const busIds = [...new Set(events.map((event) => event.busId && event.busId._id ? event.busId._id.toString() : event.busId.toString()))];
    const routes = await Route.find({ schoolId, busId: { $in: busIds } }).lean();
    const routeByBus = new Map(routes.map((route) => [route.busId.toString(), route]));

    const report = events.map((event) => {
      const eventBusId = event.busId && event.busId._id ? event.busId._id.toString() : event.busId.toString();
      const route = routeByBus.get(eventBusId);
      const stop = route && event.stopSequence
        ? route.stops.find((item) => item.sequence === event.stopSequence)
        : null;

      const plannedTime = event.eventType === "PICKED_UP"
        ? (stop ? stop.plannedPickupTime : null)
        : (stop ? stop.plannedDropTime : null);

      let delayMinutes = null;
      const plannedMinutes = toMinutesFromMidnight(plannedTime);
      if (plannedMinutes !== null) {
        const dt = new Date(event.actualTime);
        const actualMinutes = dt.getHours() * 60 + dt.getMinutes();
        delayMinutes = actualMinutes - plannedMinutes;
      }

      return {
        student: event.studentId,
        bus: event.busId,
        eventType: event.eventType,
        stopName: event.stopName,
        stopSequence: event.stopSequence,
        plannedTime,
        actualTime: event.actualTime,
        delayMinutes
      };
    });

    return success(res, report);
  } catch (err) {
    console.error("Timing report error:", err);
    return badRequest(res, "Failed to generate timing report.");
  }
};

module.exports = {
  getPickupDropTimingReport
};
