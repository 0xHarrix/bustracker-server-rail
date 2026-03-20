const mongoose = require("mongoose");
const Notification = require("./notification.model");
const { sendPushToUsers } = require("../../services/push/push.service");
const socketManager = require("../../realtime/socketManager");

const toObjectId = (id) => new mongoose.Types.ObjectId(id);

const createNotifications = async ({ schoolId, userIds, title, message, type, data }) => {
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return [];
  }

  const docs = userIds.map((userId) => ({
    schoolId: toObjectId(schoolId),
    userId: toObjectId(userId),
    title,
    message,
    type,
    data: data || {}
  }));

  return Notification.insertMany(docs);
};

const emitRealtimeNotifications = ({ userIds, payload }) => {
  const io = socketManager.getIO();
  if (!io || !Array.isArray(userIds)) return;

  userIds.forEach((userId) => {
    io.to(`user_${userId}`).emit("notification_received", payload);
  });
};

const notifyUsers = async ({
  schoolId,
  userIds,
  title,
  message,
  type,
  data,
  sendPush = true
}) => {
  const created = await createNotifications({
    schoolId,
    userIds,
    title,
    message,
    type,
    data
  });

  emitRealtimeNotifications({
    userIds,
    payload: { title, message, type, data, createdAt: new Date().toISOString() }
  });

  if (sendPush) {
    await sendPushToUsers({ userIds, title, body: message, data: data || {} });
  }

  return created;
};

module.exports = {
  notifyUsers
};
