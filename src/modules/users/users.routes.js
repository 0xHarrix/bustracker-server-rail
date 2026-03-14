const express = require("express");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorize } = require("../../middlewares/role.middleware");
const {
  createUser,
  getUsers,
  getUserById,
  assignBus,
  unassignBus,
  bulkAssignBus
} = require("./users.controller");

const router = express.Router();

// All user management routes require authentication + admin role
router.use(authenticate, authorize("admin"));

router.post("/", createUser);
router.get("/", getUsers);
router.patch("/bulk-assign-bus", bulkAssignBus); // must be before /:id routes
router.get("/:id", getUserById);
router.patch("/:id/assign-bus", assignBus);
router.patch("/:id/unassign-bus", unassignBus);

module.exports = router;
