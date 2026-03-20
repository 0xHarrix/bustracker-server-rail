const express = require("express");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorize } = require("../../middlewares/role.middleware");
const {
  triggerSos,
  emergencyBroadcast,
  listAlerts,
  resolveAlert
} = require("./alerts.controller");

const router = express.Router();

router.use(authenticate);
router.get("/", listAlerts);
router.post("/sos", authorize("driver"), triggerSos);
router.post("/broadcast", authorize("admin"), emergencyBroadcast);
router.patch("/:id/resolve", authorize("admin"), resolveAlert);

module.exports = router;
