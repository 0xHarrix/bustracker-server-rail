const mongoose = require("mongoose");
const User = require("./user.model");
const School = require("../schools/school.model");
const Bus = require("../buses/bus.model");
const Trip = require("../trips/trip.model");
const { TRIP_STATUS } = require("../trips/trip.model");
const { hashPassword } = require("../../utils/password");
const { success, created, badRequest, notFound, conflict } = require("../../utils/response");

// ── Phone normalization helper ──────────────────────────────────────────
const normalizePhone = (phone) => {
  if (!phone) return null;
  // Strip spaces, dashes, parentheses — keep digits and leading +
  return phone.replace(/[^\d+]/g, "").trim() || null;
};

// ── Bus capacity helper ─────────────────────────────────────────────────
// Returns { occupied, capacity, remaining } for a given bus.
// Does not block — just counts. Returns null capacity/remaining if
// bus has no capacity set.
const getBusOccupancy = async (busId, schoolId) => {
  const occupied = await User.countDocuments({
    busId,
    schoolId,
    role: { $in: ["parent", "student"] },
    isActive: true
  });
  return { occupied };
};

// ─────────────────────────────────────────────────────────────────────────
// POST /api/users  (Admin only)
// ─────────────────────────────────────────────────────────────────────────
const createUser = async (req, res) => {
  try {
    const { name, phone, rollNumber, password, role, schoolId, busId, parentId } = req.body;

    // ── Required field validation ─────────────────────────────────────
    if (!name || !role || !schoolId) {
      return badRequest(res, "name, role, and schoolId are required.");
    }

    if (!["admin", "driver", "parent", "student"].includes(role)) {
      return badRequest(res, "role must be admin, driver, parent, or student.");
    }

    if (!mongoose.Types.ObjectId.isValid(schoolId)) {
      return badRequest(res, "Invalid schoolId.");
    }

    if (busId && !mongoose.Types.ObjectId.isValid(busId)) {
      return badRequest(res, "Invalid busId.");
    }
    if (parentId && !mongoose.Types.ObjectId.isValid(parentId)) {
      return badRequest(res, "Invalid parentId.");
    }

    // Parent/Student records must have at least phone or rollNumber
    if ((role === "parent" || role === "student") && !phone && !rollNumber) {
      return badRequest(res, "Parent/Student records must have at least a phone number or roll number.");
    }

    // ── Verify school exists ──────────────────────────────────────────
    const school = await School.findById(schoolId).lean();
    if (!school) {
      return notFound(res, "School not found.");
    }

    if (!school.isActive) {
      return badRequest(res, "Cannot add users to an inactive school.");
    }

    // Students can optionally be linked to a parent user.
    let validatedParentId = null;
    if (role === "student" && parentId) {
      const parent = await User.findOne({
        _id: parentId,
        schoolId,
        role: "parent",
        isActive: true
      }).lean();
      if (!parent) {
        return badRequest(res, "parentId must refer to an active parent in the same school.");
      }
      validatedParentId = parent._id;
    }

    // ── Normalize and check uniqueness within school ──────────────────
    const normalizedPhone = normalizePhone(phone);
    const trimmedRollNumber = rollNumber ? rollNumber.trim() : null;

    if (normalizedPhone) {
      const phoneExists = await User.findOne({
        schoolId,
        phone: normalizedPhone
      }).lean();
      if (phoneExists) {
        return conflict(res, "A user with this phone number already exists in this school.");
      }
    }

    if (trimmedRollNumber) {
      const rollExists = await User.findOne({
        schoolId,
        rollNumber: trimmedRollNumber
      }).lean();
      if (rollExists) {
        return conflict(res, "A user with this roll number already exists in this school.");
      }
    }

    // ── Hash password if provided ─────────────────────────────────────
    let hashedPassword = null;
    if (password) {
      hashedPassword = await hashPassword(password);
    }

    // ── Create user ───────────────────────────────────────────────────
    const user = await User.create({
      name: name.trim(),
      phone: normalizedPhone,
      rollNumber: trimmedRollNumber,
      password: hashedPassword,
      role,
      parentId: validatedParentId,
      schoolId,
      busId: busId || null,
      isActive: true
    });

    return created(res, user, "User created successfully.");
  } catch (err) {
    console.error("Create user error:", err);
    if (err.code === 11000) {
      return conflict(res, "Duplicate entry. Phone or roll number already exists in this school.");
    }
    return badRequest(res, "Failed to create user.");
  }
};

// ─────────────────────────────────────────────────────────────────────────
// GET /api/users  (Admin only — scoped to their school)
// ─────────────────────────────────────────────────────────────────────────
const getUsers = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { role } = req.query;

    const filter = { schoolId };
    if (role && ["admin", "driver", "parent", "student"].includes(role)) {
      filter.role = role;
    }

    const users = await User.find(filter)
      .select("-password")
      .sort({ createdAt: -1 })
      .lean();

    return success(res, users);
  } catch (err) {
    console.error("Get users error:", err);
    return badRequest(res, "Failed to fetch users.");
  }
};

// ─────────────────────────────────────────────────────────────────────────
// GET /api/users/:id  (Admin only — scoped to their school)
// ─────────────────────────────────────────────────────────────────────────
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const { schoolId } = req.user;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return badRequest(res, "Invalid user ID.");
    }

    const user = await User.findOne({ _id: id, schoolId })
      .select("-password")
      .lean();

    if (!user) {
      return notFound(res, "User not found in your school.");
    }

    return success(res, user);
  } catch (err) {
    console.error("Get user error:", err);
    return badRequest(res, "Failed to fetch user.");
  }
};

// ─────────────────────────────────────────────────────────────────────────
// PATCH /api/users/:id/assign-bus  (Admin only — scoped to school)
// ─────────────────────────────────────────────────────────────────────────
const assignBus = async (req, res) => {
  try {
    const { id } = req.params;
    const { busId } = req.body;
    const { schoolId } = req.user;

    // ── Validate IDs ──────────────────────────────────────────────────
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return badRequest(res, "Invalid user ID.");
    }

    if (!busId) {
      return badRequest(res, "busId is required.");
    }

    if (!mongoose.Types.ObjectId.isValid(busId)) {
      return badRequest(res, "Invalid busId.");
    }

    // ── Find user (must be in admin's school) ─────────────────────────
    const user = await User.findOne({ _id: id, schoolId }).select("-password");
    if (!user) {
      return notFound(res, "User not found in your school.");
    }

    if (!["parent", "student"].includes(user.role)) {
      return badRequest(res, "Only parents or students can be assigned to a bus.");
    }

    if (!user.isActive) {
      return badRequest(res, "Cannot assign bus to an inactive user.");
    }

    // ── Find bus (must be in the same school) ─────────────────────────
    const bus = await Bus.findOne({ _id: busId, schoolId }).lean();
    if (!bus) {
      return notFound(res, "Bus not found in your school.");
    }

    if (!bus.isActive) {
      return badRequest(res, "Cannot assign user to an inactive bus.");
    }

    // ── If user was on another bus's trip, remove from that trip and clear boarding ─
    const oldBusId = user.busId;
    if (user.currentBusId) {
      await Trip.updateOne(
        { busId: user.currentBusId, status: TRIP_STATUS.ACTIVE },
        { $pull: { students: user._id } }
      );
      user.currentBusId = null;
    }
    if (oldBusId && oldBusId.toString() !== busId) {
      await Trip.updateOne(
        { busId: oldBusId, status: TRIP_STATUS.ACTIVE },
        { $pull: { students: user._id } }
      );
    }

    // ── Assign permanent route ─────────────────────────────────────────
    user.busId = bus._id;

    // ── If this bus has an active trip, add to trip and set boarded ───
    const activeTrip = await Trip.findOne(
      { busId: bus._id, schoolId, status: TRIP_STATUS.ACTIVE }
    ).lean();
    if (activeTrip) {
      await Trip.updateOne(
        { _id: activeTrip._id },
        { $addToSet: { students: user._id } }
      );
      user.currentBusId = bus._id;
    }

    await user.save();

    // ── Return with occupancy info ──────────────────────────────────
    const { occupied } = await getBusOccupancy(bus._id, schoolId);
    const remaining = bus.capacity ? bus.capacity - occupied : null;

    return success(res, {
      user,
      busOccupancy: { occupied, capacity: bus.capacity || null, remaining }
    }, "Bus assigned to user successfully.");
  } catch (err) {
    console.error("Assign bus error:", err);
    return badRequest(res, "Failed to assign bus.");
  }
};

// ─────────────────────────────────────────────────────────────────────────
// PATCH /api/users/:id/unassign-bus  (Admin only — scoped to school)
// ─────────────────────────────────────────────────────────────────────────
const unassignBus = async (req, res) => {
  try {
    const { id } = req.params;
    const { schoolId } = req.user;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return badRequest(res, "Invalid user ID.");
    }

    const user = await User.findOne({ _id: id, schoolId }).select("-password");
    if (!user) {
      return notFound(res, "User not found in your school.");
    }

    if (!user.busId) {
      return badRequest(res, "User is not assigned to any bus.");
    }

    // ── Remove from active trip (if boarded) and clear route + boarding ─
    const removedFromBusId = user.busId;
    if (user.currentBusId) {
      await Trip.updateOne(
        { busId: user.currentBusId, status: TRIP_STATUS.ACTIVE },
        { $pull: { students: user._id } }
      );
    }
    user.busId = null;
    user.currentBusId = null;
    await user.save();

    // ── Return with updated occupancy ───────────────────────────────
    const { occupied } = await getBusOccupancy(removedFromBusId, schoolId);
    const busDoc = await Bus.findById(removedFromBusId).select("capacity").lean();
    const remaining = busDoc && busDoc.capacity ? busDoc.capacity - occupied : null;

    return success(res, {
      user,
      busOccupancy: { occupied, capacity: busDoc ? busDoc.capacity : null, remaining }
    }, "Bus unassigned from user successfully.");
  } catch (err) {
    console.error("Unassign bus error:", err);
    return badRequest(res, "Failed to unassign bus.");
  }
};

// ─────────────────────────────────────────────────────────────────────────
// PATCH /api/users/bulk-assign-bus  (Admin only — scoped to school)
//
// Body: { busId: "...", userIds: ["id1", "id2", ...] }
//
// Assigns multiple parents to a bus in one request. Returns a per-user
// breakdown so the admin knows exactly what succeeded and what failed.
// ─────────────────────────────────────────────────────────────────────────
const bulkAssignBus = async (req, res) => {
  try {
    const { busId, userIds } = req.body;
    const { schoolId } = req.user;

    // ── Validate input ────────────────────────────────────────────────
    if (!busId) {
      return badRequest(res, "busId is required.");
    }

    if (!mongoose.Types.ObjectId.isValid(busId)) {
      return badRequest(res, "Invalid busId.");
    }

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return badRequest(res, "userIds must be a non-empty array.");
    }

    if (userIds.length > 100) {
      return badRequest(res, "Cannot assign more than 100 users at once.");
    }

    // ── Validate bus ──────────────────────────────────────────────────
    const bus = await Bus.findOne({ _id: busId, schoolId }).lean();
    if (!bus) {
      return notFound(res, "Bus not found in your school.");
    }

    if (!bus.isActive) {
      return badRequest(res, "Cannot assign users to an inactive bus.");
    }

    // ── Process each user ─────────────────────────────────────────────
    const results = { assigned: [], failed: [] };

    for (const userId of userIds) {
      // Validate ObjectId
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        results.failed.push({ userId, reason: "Invalid user ID." });
        continue;
      }

      const user = await User.findOne({ _id: userId, schoolId }).select("-password");

      if (!user) {
        results.failed.push({ userId, reason: "User not found in your school." });
        continue;
      }

      if (!["parent", "student"].includes(user.role)) {
        results.failed.push({ userId, name: user.name, reason: "Only parents or students can be assigned to a bus." });
        continue;
      }

      if (!user.isActive) {
        results.failed.push({ userId, name: user.name, reason: "User is inactive." });
        continue;
      }

      // Remove from old bus's active trip and clear boarding if switching
      if (user.currentBusId) {
        await Trip.updateOne(
          { busId: user.currentBusId, status: TRIP_STATUS.ACTIVE },
          { $pull: { students: user._id } }
        );
        user.currentBusId = null;
      }
      const oldBusId = user.busId;
      if (oldBusId && oldBusId.toString() !== busId) {
        await Trip.updateOne(
          { busId: oldBusId, status: TRIP_STATUS.ACTIVE },
          { $pull: { students: user._id } }
        );
      }

      user.busId = bus._id;
      await user.save();
      results.assigned.push({ userId: user._id, name: user.name });
    }

    // If this bus has an active trip, set currentBusId (boarded) and add to trip.students
    const activeTrip = await Trip.findOne(
      { busId: bus._id, schoolId, status: TRIP_STATUS.ACTIVE }
    ).lean();

    if (results.assigned.length > 0 && activeTrip) {
      const assignedIds = results.assigned.map((r) => r.userId);
      await User.updateMany(
        { _id: { $in: assignedIds }, schoolId },
        { $set: { currentBusId: bus._id } }
      );
      await Trip.updateOne(
        { _id: activeTrip._id },
        { $addToSet: { students: { $each: assignedIds } } }
      );
    }

    // ── Return with occupancy info ──────────────────────────────────
    const { occupied } = await getBusOccupancy(bus._id, schoolId);
    const remaining = bus.capacity ? bus.capacity - occupied : null;

    const message = `${results.assigned.length} assigned, ${results.failed.length} failed.`;
    return success(res, {
      ...results,
      busOccupancy: { occupied, capacity: bus.capacity || null, remaining }
    }, message);
  } catch (err) {
    console.error("Bulk assign bus error:", err);
    return badRequest(res, "Failed to bulk assign bus.");
  }
};

module.exports = { createUser, getUsers, getUserById, assignBus, unassignBus, bulkAssignBus };
