const express = require("express");
const { authenticate } = require("../../middlewares/auth.middleware");
const { authorize } = require("../../middlewares/role.middleware");
const {
  createSchool,
  getSchoolsList,
  getSchools,
  getSchoolById
} = require("./schools.controller");

const router = express.Router();

// Public: list schools for login dropdown (no auth)
router.get("/list", getSchoolsList);

// Admin-only routes
router.use(authenticate, authorize("admin"));

router.post("/", createSchool);
router.get("/", getSchools);
router.get("/:id", getSchoolById);

module.exports = router;
