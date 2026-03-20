const express = require("express");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorize } = require("../../middlewares/role.middleware");
const { getPickupDropTimingReport } = require("./reports.controller");

const router = express.Router();

router.use(authenticate, authorize("admin"));
router.get("/pickup-drop-timing", getPickupDropTimingReport);

module.exports = router;
