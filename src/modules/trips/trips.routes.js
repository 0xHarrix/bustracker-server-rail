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
  getTripById,
  getCurrentEta
} = require("./trips.controller");

const router = express.Router();

// All trip routes require authentication
router.use(authenticate);

// Driver endpoints
router.post("/start", authorize("driver"), startTrip);
router.post("/end", authorize("driver"), endTrip);
router.post("/current/board", authorize("driver"), boardStudents);
router.post("/current/unboard", authorize("driver"), unboardStudents);
router.post("/current/pickup-confirmation", authorize("driver"), boardStudents);
router.post("/current/drop-confirmation", authorize("driver"), unboardStudents);

// Parent + Driver endpoint
router.get("/current", authorize("parent", "driver"), currentTrip);
router.get("/current/eta", authorize("admin", "parent", "driver"), getCurrentEta);

// Admin endpoints
router.get("/", authorize("admin"), getTrips);
router.get("/:id", authorize("admin"), getTripById);

module.exports = router;
