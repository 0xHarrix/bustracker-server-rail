const mongoose = require("mongoose");
const Bus = require("./bus.model");
const User = require("../users/user.model");
const Trip = require("../trips/trip.model");
const { TRIP_STATUS } = require("../trips/trip.model");
const {
  success,
  created,
  badRequest,
  notFound,
  conflict
} = require("../../utils/response");

// ─────────────────────────────────────────────────────────────────────────
// POST /api/buses  (Admin only)
// ─────────────────────────────────────────────────────────────────────────
const createBus = async (req, res) => {
  try {
    const { busNumber, capacity } = req.body;
    const { schoolId } = req.user;

    // ── Validation ────────────────────────────────────────────────────
    if (!busNumber) {
      return badRequest(res, "busNumber is required.");
    }

    const trimmedBusNumber = busNumber.trim();

    if (capacity !== undefined && capacity !== null) {
      if (!Number.isInteger(capacity) || capacity < 1) {
        return badRequest(res, "capacity must be a positive integer.");
      }
    }

    // ── Check duplicate within school ─────────────────────────────────
    const existing = await Bus.findOne({
      schoolId,
      busNumber: trimmedBusNumber
    }).lean();

    if (existing) {
      return conflict(res, `Bus '${trimmedBusNumber}' already exists in your school.`);
    }

    // ── Create bus ────────────────────────────────────────────────────
    const bus = await Bus.create({
      busNumber: trimmedBusNumber,
      schoolId,
      capacity: capacity || null
    });

    const busObj = bus.toObject();
    busObj.occupied = 0;
    busObj.remaining = busObj.capacity || null;

    return created(res, busObj, "Bus created successfully.");
  } catch (err) {
    console.error("Create bus error:", err);
    if (err.code === 11000) {
      return conflict(res, "A bus with this number already exists in your school.");
    }
    return badRequest(res, "Failed to create bus.");
  }
};

// ─────────────────────────────────────────────────────────────────────────
// GET /api/buses  (Admin only — scoped to school)
// ─────────────────────────────────────────────────────────────────────────
const getBuses = async (req, res) => {
  try {
    const { schoolId } = req.user;

    const buses = await Bus.find({ schoolId })
      .populate("driverId", "name phone")
      .sort({ createdAt: -1 })
      .lean();

    // Attach occupancy to each bus
    for (const bus of buses) {
      const occupied = await User.countDocuments({
        busId: bus._id,
        schoolId,
        role: { $in: ["parent", "student"] },
        isActive: true
      });
      bus.occupied = occupied;
      bus.remaining = bus.capacity ? bus.capacity - occupied : null;
    }

    return success(res, buses);
  } catch (err) {
    console.error("Get buses error:", err);
    return badRequest(res, "Failed to fetch buses.");
  }
};

// ─────────────────────────────────────────────────────────────────────────
// GET /api/buses/:id  (Admin only — scoped to school)
// ─────────────────────────────────────────────────────────────────────────
const getBusById = async (req, res) => {
  try {
    const { id } = req.params;
    const { schoolId } = req.user;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return badRequest(res, "Invalid bus ID.");
    }

    const bus = await Bus.findOne({ _id: id, schoolId })
      .populate("driverId", "name phone")
      .lean();

    if (!bus) {
      return notFound(res, "Bus not found in your school.");
    }

    // Fetch all parents/students assigned to this bus
    const students = await User.find({
      schoolId,
      busId: bus._id,
      role: { $in: ["parent", "student"] }
    })
      .select("name phone rollNumber isActive role parentId")
      .sort({ name: 1 })
      .lean();

    bus.students = students;
    bus.occupied = students.length;
    bus.remaining = bus.capacity ? bus.capacity - students.length : null;

    return success(res, bus);
  } catch (err) {
    console.error("Get bus error:", err);
    return badRequest(res, "Failed to fetch bus.");
  }
};

// ─────────────────────────────────────────────────────────────────────────
// PATCH /api/buses/:busId/assign-driver  (Admin only)
// ─────────────────────────────────────────────────────────────────────────
const assignDriver = async (req, res) => {
  try {
    const { busId } = req.params;
    const { driverId } = req.body;
    const { schoolId } = req.user;

    // ── Validate IDs ──────────────────────────────────────────────────
    if (!mongoose.Types.ObjectId.isValid(busId)) {
      return badRequest(res, "Invalid bus ID.");
    }

    if (!driverId) {
      return badRequest(res, "driverId is required.");
    }

    if (!mongoose.Types.ObjectId.isValid(driverId)) {
      return badRequest(res, "Invalid driver ID.");
    }

    // ── Find bus (must belong to admin's school) ──────────────────────
    const bus = await Bus.findOne({ _id: busId, schoolId });
    if (!bus) {
      return notFound(res, "Bus not found in your school.");
    }

    if (!bus.isActive) {
      return badRequest(res, "Cannot assign driver to an inactive bus.");
    }

    // ── Check no ACTIVE trip on this bus ──────────────────────────────
    const activeTrip = await Trip.findOne({
      busId: bus._id,
      status: TRIP_STATUS.ACTIVE
    }).lean();

    if (activeTrip) {
      return badRequest(res, "Cannot reassign driver while bus has an active trip.");
    }

    // ── Validate driver ───────────────────────────────────────────────
    const driver = await User.findOne({
      _id: driverId,
      schoolId,
      role: "driver"
    }).lean();

    if (!driver) {
      return notFound(res, "Driver not found in your school.");
    }

    if (!driver.isActive) {
      return badRequest(res, "Cannot assign an inactive driver.");
    }

    // ── Check driver not already assigned to another bus ──────────────
    const existingAssignment = await Bus.findOne({
      schoolId,
      driverId,
      _id: { $ne: bus._id }
    }).lean();

    if (existingAssignment) {
      return conflict(
        res,
        `Driver is already assigned to bus '${existingAssignment.busNumber}'. Unassign first.`
      );
    }

    // ── Unassign previous driver from this bus (if any) ───────────────
    if (bus.driverId && bus.driverId.toString() !== driverId) {
      await User.findByIdAndUpdate(bus.driverId, { busId: null });
    }

    // ── Assign ────────────────────────────────────────────────────────
    bus.driverId = driverId;
    await bus.save();

    // Update driver's busId reference
    await User.findByIdAndUpdate(driverId, { busId: bus._id });

    const populated = await Bus.findById(bus._id)
      .populate("driverId", "name phone")
      .lean();

    return success(res, populated, "Driver assigned successfully.");
  } catch (err) {
    console.error("Assign driver error:", err);
    return badRequest(res, "Failed to assign driver.");
  }
};

// ─────────────────────────────────────────────────────────────────────────
// PATCH /api/buses/:busId/unassign-driver  (Admin only)
// ─────────────────────────────────────────────────────────────────────────
const unassignDriver = async (req, res) => {
  try {
    const { busId } = req.params;
    const { schoolId } = req.user;

    if (!mongoose.Types.ObjectId.isValid(busId)) {
      return badRequest(res, "Invalid bus ID.");
    }

    const bus = await Bus.findOne({ _id: busId, schoolId });
    if (!bus) {
      return notFound(res, "Bus not found in your school.");
    }

    if (!bus.driverId) {
      return badRequest(res, "No driver is assigned to this bus.");
    }

    // Check no active trip
    const activeTrip = await Trip.findOne({
      busId: bus._id,
      status: TRIP_STATUS.ACTIVE
    }).lean();

    if (activeTrip) {
      return badRequest(res, "Cannot unassign driver while bus has an active trip.");
    }

    // Clear driver's busId
    await User.findByIdAndUpdate(bus.driverId, { busId: null });

    // Clear bus's driverId
    bus.driverId = null;
    await bus.save();

    return success(res, bus, "Driver unassigned successfully.");
  } catch (err) {
    console.error("Unassign driver error:", err);
    return badRequest(res, "Failed to unassign driver.");
  }
};

module.exports = { createBus, getBuses, getBusById, assignDriver, unassignDriver };
