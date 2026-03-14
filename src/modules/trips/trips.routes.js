const express = require("express");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorize } = require("../../middlewares/role.middleware");
const {
  startTrip,
  endTrip,
  currentTrip,
  boardStudents,
  unboardStudents,
  getTrips,
  getTripById
} = require("./trips.controller");

const router = express.Router();

// All trip routes require authentication
router.use(authenticate);

// Driver endpoints
router.post("/start", authorize("driver"), startTrip);
router.post("/end", authorize("driver"), endTrip);
router.post("/current/board", authorize("driver"), boardStudents);
router.post("/current/unboard", authorize("driver"), unboardStudents);

// Parent + driver: view current trip for assigned bus
router.get("/current", authorize("parent", "driver"), currentTrip);

// Admin endpoints
router.get("/", authorize("admin"), getTrips);
router.get("/:id", authorize("admin"), getTripById);

module.exports = router;
