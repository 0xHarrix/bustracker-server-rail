const express = require("express");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorize } = require("../../middlewares/role.middleware");
const {
  createBus,
  getBuses,
  getBusById,
  assignDriver,
  unassignDriver
} = require("./buses.controller");

const router = express.Router();

// All bus management routes require authentication + admin role
router.use(authenticate, authorize("admin"));

router.post("/", createBus);
router.get("/", getBuses);
router.get("/:id", getBusById);
router.patch("/:busId/assign-driver", assignDriver);
router.patch("/:busId/unassign-driver", unassignDriver);

module.exports = router;
