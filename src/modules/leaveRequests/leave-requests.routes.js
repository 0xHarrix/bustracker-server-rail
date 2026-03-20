const express = require("express");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorize } = require("../../middlewares/role.middleware");
const {
  createLeaveRequest,
  myLeaveRequests,
  cancelLeaveRequest,
  adminListLeaveRequests,
  reviewLeaveRequest
} = require("./leave-requests.controller");

const router = express.Router();

router.use(authenticate);

router.post("/", authorize("parent"), createLeaveRequest);
router.get("/me", authorize("parent"), myLeaveRequests);
router.patch("/:id/cancel", authorize("parent"), cancelLeaveRequest);

router.get("/", authorize("admin"), adminListLeaveRequests);
router.patch("/:id/review", authorize("admin"), reviewLeaveRequest);

module.exports = router;
