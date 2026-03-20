const mongoose = require("mongoose");
const Trip = require("./trip.model");
const { TRIP_STATUS } = require("./trip.model");
const Bus = require("../buses/bus.model");
const User = require("../users/user.model");
const socketManager = require("../../realtime/socketManager");
const AttendanceEvent = require("../attendance/attendance-event.model");
const { ATTENDANCE_EVENT_TYPE } = require("../attendance/attendance-event.model");
const { notifyUsers } = require("../notifications/notification.service");
const { computeEtaForBus } = require("../../services/eta/eta.service");
const {
  success,
  badRequest,
  notFound,
  conflict
} = require("../../utils/response");

const resolveNotificationRecipients = (users = []) => {
  const ids = new Set();
  users.forEach((user) => {
    if (!user) return;
    // Legacy model: parent record acts as student.
    if (user.role === "parent") {
      ids.add(user._id.toString());
      return;
    }
    // New model: student records notify linked parent if present.
    if (user.parentId) {
      ids.add(user.parentId.toString());
      return;
    }
    // Fallback to student user itself if no parent is linked.
    ids.add(user._id.toString());
  });
  return Array.from(ids);
};

// ─────────────────────────────────────────────────────────────────────────
// POST /api/trips/start  (Driver only)
// ─────────────────────────────────────────────────────────────────────────
const startTrip = async (req, res) => {
  try {
    const { userId, schoolId, busId } = req.user;

    // ── Driver must have an assigned bus ───────────────────────────────
    if (!busId) {
      return badRequest(res, "You are not assigned to any bus.");
    }

    // ── Verify bus exists, is active, and belongs to driver's school ──
    const bus = await Bus.findOne({
      _id: busId,
      schoolId,
      isActive: true
    }).lean();

    if (!bus) {
      return notFound(res, "Assigned bus not found or is inactive.");
    }

    // Verify the bus is actually assigned to this driver
    if (!bus.driverId || bus.driverId.toString() !== userId) {
      return badRequest(res, "You are not the assigned driver for this bus.");
    }

    // ── Check no ACTIVE trip for this bus (application-level check) ───
    const existing = await Trip.findOne({
      busId: bus._id,
      status: TRIP_STATUS.ACTIVE
    }).lean();

    if (existing) {
      return conflict(res, "This bus already has an active trip. End it first.");
    }

    // ── Create trip with empty students ───────────────────────────────
    // Students board at different stops; driver marks them via POST /trips/current/board.
    // The unique partial index on { busId } where status="ACTIVE"
    // acts as the DB-level race condition guard.
    let trip;
    try {
      trip = await Trip.create({
        busId: bus._id,
        driverId: userId,
        schoolId,
        startTime: new Date(),
        status: TRIP_STATUS.ACTIVE,
        students: []
      });
    } catch (err) {
      if (err.code === 11000) {
        return conflict(res, "This bus already has an active trip (concurrent request detected).");
      }
      throw err;
    }

    // ── Sync in-memory cache ──────────────────────────────────────────
    socketManager.addActiveTrip(bus._id.toString(), trip._id.toString());

    // ── Emit trip_started to parents + admins ─────────────────────────
    const io = socketManager.getIO();
    if (io) {
      const tripEvent = {
        tripId: trip._id,
        busId: bus._id,
        driverId: userId,
        startTime: trip.startTime,
        status: trip.status
      };
      io.to(`bus_${bus._id.toString()}`).emit("trip_started", tripEvent);
      io.to(`school_${schoolId}`).emit("trip_started", tripEvent);
    }

    return success(res, trip, "Trip started successfully.");
  } catch (err) {
    console.error("Start trip error:", err);
    return badRequest(res, "Failed to start trip.");
  }
};

// ─────────────────────────────────────────────────────────────────────────
// POST /api/trips/end  (Driver only)
// ─────────────────────────────────────────────────────────────────────────
const endTrip = async (req, res) => {
  try {
    const { userId, schoolId, busId } = req.user;

    if (!busId) {
      return badRequest(res, "You are not assigned to any bus.");
    }

    // ── Find the ACTIVE trip for this driver's bus ────────────────────
    const trip = await Trip.findOne({
      busId,
      driverId: userId,
      schoolId,
      status: TRIP_STATUS.ACTIVE
    });

    if (!trip) {
      return notFound(res, "No active trip found for your bus.");
    }

    // ── Complete the trip ─────────────────────────────────────────────
    trip.status = TRIP_STATUS.COMPLETED;
    trip.endTime = new Date();
    await trip.save();

    // ── Clear boarding state only (Model A). busId = permanent route stays.
    if (trip.students && trip.students.length > 0) {
      await User.updateMany(
        { _id: { $in: trip.students }, schoolId },
        { $set: { currentBusId: null } }
      );
    }

    // ── Clear in-memory cache ─────────────────────────────────────────
    socketManager.removeActiveTrip(busId);

    // ── Emit trip_ended to parents + admins ─────────────────────────
    const io = socketManager.getIO();
    const busRoom = `bus_${busId}`;
    if (io) {
      const tripEndEvent = {
        tripId: trip._id,
        busId: trip.busId,
        endTime: trip.endTime,
        status: trip.status
      };

      // Send trip_ended FIRST so parents receive the event
      io.to(busRoom).emit("trip_ended", tripEndEvent);

      // Notify admins in the school room
      io.to(`school_${schoolId}`).emit("trip_ended", tripEndEvent);

      // Force all sockets out of this bus room so they don't receive stale updates.
      // Parents keep busId (route); they rejoin bus_<id> on reconnect and get updates when the next trip starts.
      io.in(busRoom).socketsLeave(busRoom);
    }

    // ── Return completed trip with populated students ─────────────────
    const completedTrip = await Trip.findById(trip._id)
      .populate("busId", "busNumber")
      .populate("driverId", "name phone")
      .populate("students", "name phone rollNumber")
      .lean();

    return success(res, completedTrip, "Trip ended successfully.");
  } catch (err) {
    console.error("End trip error:", err);
    return badRequest(res, "Failed to end trip.");
  }
};

// ─────────────────────────────────────────────────────────────────────────
// GET /api/trips/current  (Parent + Driver)
// ─────────────────────────────────────────────────────────────────────────
const currentTrip = async (req, res) => {
  try {
    const { busId } = req.user;

    if (!busId) {
      return success(res, { status: "NOT_RUNNING" }, "No bus assigned.");
    }

    // ── Find ACTIVE trip for the user's assigned bus ───────────────────
    // Use bus-level lookup to stay consistent with startTrip conflict checks.
    const trip = await Trip.findOne({
      busId,
      status: TRIP_STATUS.ACTIVE
    })
      .populate("busId", "busNumber")
      .populate("driverId", "name phone")
      .populate("students", "name phone rollNumber")
      .lean();

    if (!trip) {
      return success(res, { status: "NOT_RUNNING" }, "No active trip for your bus.");
    }

    return success(res, trip, "Active trip found.");
  } catch (err) {
    console.error("Current trip error:", err);
    return badRequest(res, "Failed to fetch current trip.");
  }
};

// ─────────────────────────────────────────────────────────────────────────
// POST /api/trips/current/board  (Driver only — mark student(s) as boarded at a stop)
// Body: { studentId: "..." } or { studentIds: ["...", "..."] }
// ─────────────────────────────────────────────────────────────────────────
const boardStudents = async (req, res) => {
  try {
    const { userId, schoolId, busId } = req.user;
    const { studentId, studentIds, stopName, stopSequence } = req.body;
    const parsedStopSequence = Number.isFinite(Number(stopSequence)) ? Number(stopSequence) : null;

    if (!busId) {
      return badRequest(res, "You are not assigned to any bus.");
    }

    const ids = studentIds && Array.isArray(studentIds)
      ? studentIds
      : studentId
        ? [studentId]
        : [];
    if (ids.length === 0) {
      return badRequest(res, "Provide studentId or studentIds array.");
    }

    // Validate and normalize ObjectIds
    const validIds = ids
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));
    if (validIds.length === 0) {
      return badRequest(res, "No valid student IDs.");
    }

    const trip = await Trip.findOne({
      busId,
      driverId: userId,
      schoolId,
      status: TRIP_STATUS.ACTIVE
    });
    if (!trip) {
      return notFound(res, "No active trip for your bus.");
    }

    // Ensure ObjectIds for consistent matching (req.user has string ids)
    const schoolIdObj = new mongoose.Types.ObjectId(schoolId);
    const busIdObj = trip.busId && trip.busId._id ? trip.busId._id : new mongoose.Types.ObjectId(trip.busId);

    // Students must be on this route (busId = this bus), same school, parent role
    const users = await User.find({
      _id: { $in: validIds },
      schoolId: schoolIdObj,
      busId: busIdObj,
      role: { $in: ["parent", "student"] },
      isActive: true
    }).select("_id name role parentId").lean();

    const toAdd = users.map((u) => u._id);
    if (toAdd.length === 0) {
      return badRequest(res, "No students found on this route with the given IDs.");
    }

    await Trip.updateOne(
      { _id: trip._id },
      { $addToSet: { students: { $each: toAdd } } }
    );
    await User.updateMany(
      { _id: { $in: toAdd }, schoolId },
      { $set: { currentBusId: trip.busId } }
    );

    if (toAdd.length > 0) {
      await AttendanceEvent.insertMany(
        toAdd.map((studentObjectId) => ({
          schoolId,
          busId: trip.busId,
          tripId: trip._id,
          studentId: studentObjectId,
          driverId: userId,
          eventType: ATTENDANCE_EVENT_TYPE.PICKED_UP,
          stopName: stopName || null,
          stopSequence: parsedStopSequence,
          actualTime: new Date()
        }))
      );

      const recipientIds = resolveNotificationRecipients(users);
      await notifyUsers({
        schoolId,
        userIds: recipientIds,
        title: "Pickup confirmed",
        message: `Pickup confirmed${stopName ? ` at ${stopName}` : ""}.`,
        type: "PICKUP_CONFIRMED",
        data: {
          tripId: trip._id.toString(),
          busId: trip.busId.toString(),
          stopName: stopName || null,
          stopSequence: parsedStopSequence
        }
      });
    }

    const io = socketManager.getIO();
    if (io) {
      io.to(`bus_${busId}`).emit("pickup_confirmed", {
        tripId: trip._id,
        busId,
        studentIds: toAdd.map((id) => id.toString()),
        stopName: stopName || null,
        stopSequence: parsedStopSequence,
        timestamp: new Date().toISOString()
      });
    }

    const tripUpdated = await Trip.findById(trip._id)
      .populate("busId", "busNumber")
      .populate("driverId", "name phone")
      .populate("students", "name phone rollNumber")
      .lean();
    tripUpdated.occupied = tripUpdated.students ? tripUpdated.students.length : 0;
    tripUpdated.remaining = tripUpdated.busId && tripUpdated.busId.capacity
      ? tripUpdated.busId.capacity - tripUpdated.occupied
      : null;

    return success(res, tripUpdated, `${toAdd.length} student(s) boarded.`);
  } catch (err) {
    console.error("Board students error:", err);
    return badRequest(res, "Failed to board students.");
  }
};

// ─────────────────────────────────────────────────────────────────────────
// POST /api/trips/current/unboard  (Driver only — remove student(s) from current trip)
// Body: { studentId: "..." } or { studentIds: ["...", "..."] }
// ─────────────────────────────────────────────────────────────────────────
const unboardStudents = async (req, res) => {
  try {
    const { userId, schoolId, busId } = req.user;
    const { studentId, studentIds, stopName, stopSequence } = req.body;
    const parsedStopSequence = Number.isFinite(Number(stopSequence)) ? Number(stopSequence) : null;

    if (!busId) {
      return badRequest(res, "You are not assigned to any bus.");
    }

    const ids = studentIds && Array.isArray(studentIds)
      ? studentIds
      : studentId
        ? [studentId]
        : [];
    if (ids.length === 0) {
      return badRequest(res, "Provide studentId or studentIds array.");
    }

    const validIds = ids.filter((id) => mongoose.Types.ObjectId.isValid(id));
    if (validIds.length === 0) {
      return badRequest(res, "No valid student IDs.");
    }

    const trip = await Trip.findOne({
      busId,
      driverId: userId,
      schoolId,
      status: TRIP_STATUS.ACTIVE
    });
    if (!trip) {
      return notFound(res, "No active trip for your bus.");
    }

    await Trip.updateOne(
      { _id: trip._id },
      { $pull: { students: { $in: validIds } } }
    );
    await User.updateMany(
      { _id: { $in: validIds }, schoolId, currentBusId: trip.busId },
      { $set: { currentBusId: null } }
    );

    const dropCandidates = await User.find({
      _id: { $in: validIds },
      schoolId,
      role: { $in: ["parent", "student"] }
    })
      .select("_id role parentId")
      .lean();

    if (dropCandidates.length > 0) {
      await AttendanceEvent.insertMany(
        dropCandidates.map((student) => ({
          schoolId,
          busId: trip.busId,
          tripId: trip._id,
          studentId: student._id,
          driverId: userId,
          eventType: ATTENDANCE_EVENT_TYPE.DROPPED,
          stopName: stopName || null,
          stopSequence: parsedStopSequence,
          actualTime: new Date()
        }))
      );

      const recipientIds = resolveNotificationRecipients(dropCandidates);
      await notifyUsers({
        schoolId,
        userIds: recipientIds,
        title: "Drop confirmed",
        message: `Drop confirmed${stopName ? ` at ${stopName}` : ""}.`,
        type: "DROP_CONFIRMED",
        data: {
          tripId: trip._id.toString(),
          busId: trip.busId.toString(),
          stopName: stopName || null,
          stopSequence: parsedStopSequence
        }
      });
    }

    const io = socketManager.getIO();
    if (io) {
      io.to(`bus_${busId}`).emit("drop_confirmed", {
        tripId: trip._id,
        busId,
        studentIds: dropCandidates.map((item) => item._id.toString()),
        stopName: stopName || null,
        stopSequence: parsedStopSequence,
        timestamp: new Date().toISOString()
      });
    }

    const tripUpdated = await Trip.findById(trip._id)
      .populate("busId", "busNumber")
      .populate("driverId", "name phone")
      .populate("students", "name phone rollNumber")
      .lean();
    tripUpdated.occupied = tripUpdated.students ? tripUpdated.students.length : 0;
    tripUpdated.remaining = tripUpdated.busId && tripUpdated.busId.capacity
      ? tripUpdated.busId.capacity - tripUpdated.occupied
      : null;

    return success(res, tripUpdated, `${validIds.length} student(s) unboarded.`);
  } catch (err) {
    console.error("Unboard students error:", err);
    return badRequest(res, "Failed to unboard students.");
  }
};

// ─────────────────────────────────────────────────────────────────────────
// GET /api/trips  (Admin only — all trips for their school)
// ─────────────────────────────────────────────────────────────────────────
const getTrips = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { status } = req.query;

    const filter = { schoolId };
    if (status && [TRIP_STATUS.ACTIVE, TRIP_STATUS.COMPLETED].includes(status)) {
      filter.status = status;
    }

    const trips = await Trip.find(filter)
      .populate("busId", "busNumber capacity")
      .populate("driverId", "name phone")
      .sort({ createdAt: -1 })
      .lean();

    // Attach occupancy to each trip
    for (const trip of trips) {
      trip.occupied = trip.students ? trip.students.length : 0;
      trip.remaining = trip.busId && trip.busId.capacity
        ? trip.busId.capacity - trip.occupied
        : null;
    }

    return success(res, trips);
  } catch (err) {
    console.error("Get trips error:", err);
    return badRequest(res, "Failed to fetch trips.");
  }
};

// ─────────────────────────────────────────────────────────────────────────
// GET /api/trips/:id  (Admin only — single trip with students on that bus)
// ─────────────────────────────────────────────────────────────────────────
const getTripById = async (req, res) => {
  try {
    const { id } = req.params;
    const { schoolId } = req.user;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return badRequest(res, "Invalid trip ID.");
    }

    const trip = await Trip.findOne({ _id: id, schoolId })
      .populate("busId", "busNumber capacity")
      .populate("driverId", "name phone")
      .populate("students", "name phone rollNumber isActive")
      .lean();

    if (!trip) {
      return notFound(res, "Trip not found in your school.");
    }

    trip.occupied = trip.students ? trip.students.length : 0;
    trip.remaining = trip.busId && trip.busId.capacity
      ? trip.busId.capacity - trip.occupied
      : null;

    return success(res, trip);
  } catch (err) {
    console.error("Get trip error:", err);
    return badRequest(res, "Failed to fetch trip.");
  }
};

// ─────────────────────────────────────────────────────────────────────────
// GET /api/trips/current/eta  (Parent + Driver + Admin)
// ─────────────────────────────────────────────────────────────────────────
const getCurrentEta = async (req, res) => {
  try {
    const { role, schoolId, busId: userBusId, userId } = req.user;
    const requestedBusId = req.query.busId;

    const targetBusId = role === "admin" ? requestedBusId : userBusId;
    if (!targetBusId) {
      return badRequest(res, "busId is required.");
    }

    const lastLocation = socketManager.getLastLocation(targetBusId);
    if (!lastLocation) {
      return success(res, { status: "NO_LIVE_LOCATION" }, "No live location available.");
    }

    const eta = await computeEtaForBus({
      schoolId,
      busId: targetBusId,
      origin: { lat: lastLocation.lat, lng: lastLocation.lng },
      userId: role === "parent" ? userId : null
    });

    if (!eta) {
      return success(res, { status: "NO_ROUTE_CONFIGURED" }, "No active route configured.");
    }

    socketManager.setLatestEta(targetBusId, eta);
    return success(res, eta);
  } catch (err) {
    console.error("Current ETA error:", err);
    return badRequest(res, "Failed to fetch ETA.");
  }
};

module.exports = {
  startTrip,
  endTrip,
  currentTrip,
  boardStudents,
  unboardStudents,
  getTrips,
  getTripById,
  getCurrentEta
};
