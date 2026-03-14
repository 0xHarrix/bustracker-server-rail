const School = require("./school.model");
const { success, created, badRequest, notFound, conflict } = require("../../utils/response");

// ─────────────────────────────────────────────────────────────────────────
// POST /api/schools  (Admin only)
// ─────────────────────────────────────────────────────────────────────────
const createSchool = async (req, res) => {
  try {
    const { name, schoolCode } = req.body;

    if (!name || !schoolCode) {
      return badRequest(res, "name and schoolCode are required.");
    }

    const trimmedCode = schoolCode.trim().toUpperCase();

    // Check for duplicate schoolCode
    const existing = await School.findOne({ schoolCode: trimmedCode }).lean();
    if (existing) {
      return conflict(res, `School with code '${trimmedCode}' already exists.`);
    }

    const school = await School.create({
      name: name.trim(),
      schoolCode: trimmedCode
    });

    return created(res, school, "School created successfully.");
  } catch (err) {
    console.error("Create school error:", err);
    if (err.code === 11000) {
      return conflict(res, "A school with this code already exists.");
    }
    return badRequest(res, "Failed to create school.");
  }
};

// ─────────────────────────────────────────────────────────────────────────
// GET /api/schools/list  (Public – for login screen dropdown)
// ─────────────────────────────────────────────────────────────────────────
const getSchoolsList = async (req, res) => {
  try {
    const schools = await School.find({ isActive: true })
      .select("_id name schoolCode")
      .sort({ name: 1 })
      .lean();
    return success(res, schools);
  } catch (err) {
    console.error("Get schools list error:", err);
    return badRequest(res, "Failed to fetch schools.");
  }
};

// ─────────────────────────────────────────────────────────────────────────
// GET /api/schools  (Admin only)
// ─────────────────────────────────────────────────────────────────────────
const getSchools = async (req, res) => {
  try {
    const schools = await School.find().sort({ createdAt: -1 }).lean();
    return success(res, schools);
  } catch (err) {
    console.error("Get schools error:", err);
    return badRequest(res, "Failed to fetch schools.");
  }
};

// ─────────────────────────────────────────────────────────────────────────
// GET /api/schools/:id  (Admin only)
// ─────────────────────────────────────────────────────────────────────────
const getSchoolById = async (req, res) => {
  try {
    const { id } = req.params;

    const mongoose = require("mongoose");
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return badRequest(res, "Invalid school ID.");
    }

    const school = await School.findById(id).lean();
    if (!school) {
      return notFound(res, "School not found.");
    }

    return success(res, school);
  } catch (err) {
    console.error("Get school error:", err);
    return badRequest(res, "Failed to fetch school.");
  }
};

module.exports = { createSchool, getSchoolsList, getSchools, getSchoolById };
