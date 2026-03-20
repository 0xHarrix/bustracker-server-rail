const Alert = require("./alert.model");
const { ALERT_TYPE, ALERT_STATUS } = require("./alert.model");
const User = require("../users/user.model");
const { notifyUsers } = require("../notifications/notification.service");
const socketManager = require("../../realtime/socketManager");
const { success, created, badRequest, notFound } = require("../../utils/response");

const emitAlertEvent = (eventName, payload, schoolId, busId) => {
  const io = socketManager.getIO();
  if (!io) return;
  io.to(`school_${schoolId}`).emit(eventName, payload);
  if (busId) io.to(`bus_${busId}`).emit(eventName, payload);
};

const triggerSos = async (req, res) => {
  try {
    const { userId, schoolId, busId } = req.user;
    const { message, severity } = req.body;

    if (!busId) return badRequest(res, "Driver must be assigned to a bus to send SOS.");

    const alert = await Alert.create({
      schoolId,
      busId,
      type: ALERT_TYPE.SOS,
      severity: severity || "CRITICAL",
      message: message || "Driver triggered SOS.",
      raisedBy: userId
    });

    const admins = await User.find({ schoolId, role: "admin", isActive: true }).select("_id").lean();
    await notifyUsers({
      schoolId,
      userIds: admins.map((a) => a._id.toString()),
      title: "SOS Alert",
      message: alert.message,
      type: "SOS_ALERT",
      data: { alertId: alert._id.toString(), busId }
    });

    emitAlertEvent("sos_triggered", alert, schoolId, busId);
    return created(res, alert, "SOS alert sent.");
  } catch (err) {
    console.error("SOS error:", err);
    return badRequest(res, "Failed to trigger SOS.");
  }
};

const emergencyBroadcast = async (req, res) => {
  try {
    const { schoolId, userId } = req.user;
    const { message, severity, busId } = req.body;
    if (!message) return badRequest(res, "message is required.");

    const alert = await Alert.create({
      schoolId,
      busId: busId || null,
      type: ALERT_TYPE.EMERGENCY_BROADCAST,
      severity: severity || "HIGH",
      message: String(message).trim(),
      raisedBy: userId
    });

    const recipientsFilter = { schoolId, isActive: true };
    if (busId) recipientsFilter.busId = busId;

    const recipients = await User.find(recipientsFilter).select("_id").lean();
    await notifyUsers({
      schoolId,
      userIds: recipients.map((r) => r._id.toString()),
      title: "Emergency alert",
      message: alert.message,
      type: "EMERGENCY_BROADCAST",
      data: { alertId: alert._id.toString(), busId: busId || null }
    });

    emitAlertEvent("emergency_broadcast", alert, schoolId, busId);
    return created(res, alert, "Emergency alert broadcasted.");
  } catch (err) {
    console.error("Emergency broadcast error:", err);
    return badRequest(res, "Failed to broadcast emergency alert.");
  }
};

const listAlerts = async (req, res) => {
  try {
    const { schoolId, role, busId, userId } = req.user;
    const filter = { schoolId };
    if (req.query.status && Object.values(ALERT_STATUS).includes(req.query.status)) {
      filter.status = req.query.status;
    }

    if (role === "parent" || role === "driver") {
      filter.$or = [{ busId: null }, { busId: busId || null }, { raisedBy: userId }];
    }

    const items = await Alert.find(filter)
      .populate("raisedBy", "name role")
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    return success(res, items);
  } catch (err) {
    console.error("List alerts error:", err);
    return badRequest(res, "Failed to fetch alerts.");
  }
};

const resolveAlert = async (req, res) => {
  try {
    const { schoolId, userId } = req.user;
    const { id } = req.params;
    const alert = await Alert.findOneAndUpdate(
      { _id: id, schoolId, status: ALERT_STATUS.ACTIVE },
      { $set: { status: ALERT_STATUS.RESOLVED, resolvedBy: userId, resolvedAt: new Date() } },
      { new: true }
    );
    if (!alert) return notFound(res, "Active alert not found.");
    emitAlertEvent("alert_resolved", alert, schoolId, alert.busId ? alert.busId.toString() : null);
    return success(res, alert, "Alert resolved.");
  } catch (err) {
    console.error("Resolve alert error:", err);
    return badRequest(res, "Failed to resolve alert.");
  }
};

module.exports = {
  triggerSos,
  emergencyBroadcast,
  listAlerts,
  resolveAlert
};
