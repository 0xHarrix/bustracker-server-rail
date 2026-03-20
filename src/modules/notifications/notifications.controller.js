const DeviceToken = require("./device-token.model");
const Notification = require("./notification.model");
const { success, badRequest } = require("../../utils/response");

const registerDeviceToken = async (req, res) => {
  try {
    const { token, platform } = req.body;
    const { userId, schoolId } = req.user;

    if (!token || !platform) {
      return badRequest(res, "token and platform are required.");
    }

    if (!["android", "ios", "web"].includes(platform)) {
      return badRequest(res, "platform must be android, ios, or web.");
    }

    await DeviceToken.findOneAndUpdate(
      { userId, token },
      { $set: { platform, isActive: true, schoolId, lastSeenAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return success(res, null, "Device token registered.");
  } catch (err) {
    console.error("Register device token error:", err);
    return badRequest(res, "Failed to register device token.");
  }
};

const unregisterDeviceToken = async (req, res) => {
  try {
    const { token } = req.body;
    const { userId } = req.user;
    if (!token) return badRequest(res, "token is required.");

    await DeviceToken.updateOne(
      { userId, token },
      { $set: { isActive: false, lastSeenAt: new Date() } }
    );

    return success(res, null, "Device token unregistered.");
  } catch (err) {
    console.error("Unregister device token error:", err);
    return badRequest(res, "Failed to unregister device token.");
  }
};

const myNotifications = async (req, res) => {
  try {
    const { userId } = req.user;
    const limit = Math.min(Number(req.query.limit) || 20, 100);

    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return success(res, notifications);
  } catch (err) {
    console.error("Get notifications error:", err);
    return badRequest(res, "Failed to fetch notifications.");
  }
};

const markAsRead = async (req, res) => {
  try {
    const { userId } = req.user;
    const { id } = req.params;

    await Notification.updateOne(
      { _id: id, userId },
      { $set: { isRead: true, readAt: new Date() } }
    );

    return success(res, null, "Notification marked as read.");
  } catch (err) {
    console.error("Mark read error:", err);
    return badRequest(res, "Failed to update notification.");
  }
};

const unreadCount = async (req, res) => {
  try {
    const { userId } = req.user;
    const count = await Notification.countDocuments({ userId, isRead: false });
    return success(res, { count });
  } catch (err) {
    console.error("Unread count error:", err);
    return badRequest(res, "Failed to fetch unread count.");
  }
};

module.exports = {
  registerDeviceToken,
  unregisterDeviceToken,
  myNotifications,
  markAsRead,
  unreadCount
};
