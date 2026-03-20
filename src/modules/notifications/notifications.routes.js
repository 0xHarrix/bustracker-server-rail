const express = require("express");
const { authenticate } = require("../../middlewares/auth.middleware");
const {
  registerDeviceToken,
  unregisterDeviceToken,
  myNotifications,
  markAsRead,
  unreadCount
} = require("./notifications.controller");

const router = express.Router();

router.use(authenticate);
router.post("/device-token", registerDeviceToken);
router.post("/device-token/unregister", unregisterDeviceToken);
router.get("/me", myNotifications);
router.get("/me/unread-count", unreadCount);
router.patch("/me/:id/read", markAsRead);

module.exports = router;
