const express = require("express");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorize } = require("../../middlewares/role.middleware");
const { listAttendance, myAttendance } = require("./attendance.controller");

const router = express.Router();

router.use(authenticate);
router.get("/", authorize("admin"), listAttendance);
router.get("/me", authorize("parent"), myAttendance);

module.exports = router;
