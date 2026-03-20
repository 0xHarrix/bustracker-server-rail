const { Server } = require("socket.io");
const { verifyToken } = require("../utils/jwt");
const User = require("../modules/users/user.model");
const Trip = require("../modules/trips/trip.model");
const { TRIP_STATUS } = require("../modules/trips/trip.model");
const socketManager = require("./socketManager");
const { computeEtaForBus } = require("../services/eta/eta.service");

// ── Config ───────────────────────────────────────────────────────────────
const MIN_UPDATE_INTERVAL_MS = 3000; // 3 second minimum between GPS updates

// ── Rate limit tracker: driverId -> last emit timestamp ──────────────────
const lastEmitTimestamps = {};
const lastEtaCalcTimestamps = {};
const ETA_CALC_INTERVAL_MS = 30000;

// ─────────────────────────────────────────────────────────────────────────
// Socket authentication middleware
// ─────────────────────────────────────────────────────────────────────────
const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error("Authentication required. Provide token in handshake.auth.token."));
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return next(new Error("Token has expired. Please login again."));
      }
      return next(new Error("Invalid token."));
    }

    // Load user from DB to verify they still exist and are active
    const user = await User.findById(decoded.userId).select("-password").lean();

    if (!user) {
      return next(new Error("User no longer exists."));
    }

    if (!user.isActive) {
      return next(new Error("Account has been deactivated."));
    }

    // Attach user context to socket (Model A: busId = route, currentBusId = boarded)
    socket.user = {
      userId: user._id.toString(),
      role: user.role,
      schoolId: user.schoolId.toString(),
      busId: user.busId ? user.busId.toString() : null,
      currentBusId: user.currentBusId ? user.currentBusId.toString() : null
    };

    next();
  } catch (err) {
    console.error("Socket auth error:", err.message);
    return next(new Error("Authentication failed."));
  }
};

// ─────────────────────────────────────────────────────────────────────────
// Join appropriate room based on role
// ─────────────────────────────────────────────────────────────────────────
const joinRoomByRole = (socket) => {
  const { role, busId, userId } = socket.user;

  switch (role) {
    case "parent":
    case "driver":
    case "admin": {
      socket.join(`user_${userId}`);
      break;
    }
    default:
      break;
  }

  switch (role) {
    case "parent": {
      if (busId) {
        const room = `bus_${busId}`;
        socket.join(room);
        console.log(`[Socket] Parent ${userId} joined room ${room}`);
      } else {
        console.log(`[Socket] Parent ${userId} connected but has no bus assigned`);
      }
      break;
    }

    case "driver": {
      // Drivers join a personal room so we can target them for errors
      const driverRoom = `driver_${userId}`;
      socket.join(driverRoom);
      console.log(`[Socket] Driver ${userId} joined room ${driverRoom}`);

      // Also join their bus room so they receive trip events
      if (busId) {
        const busRoom = `bus_${busId}`;
        socket.join(busRoom);
        console.log(`[Socket] Driver ${userId} also joined room ${busRoom}`);
      }
      break;
    }

    case "admin": {
      // Admins join a school-wide room to receive all bus locations
      const schoolRoom = `school_${socket.user.schoolId}`;
      socket.join(schoolRoom);
      console.log(`[Socket] Admin ${userId} joined room ${schoolRoom}`);

      // Send current live locations immediately on connect
      const liveLocations = socketManager.getAllLocationsForSchool(socket.user.schoolId);
      if (liveLocations.length > 0) {
        socket.emit("all_locations", liveLocations);
      }
      break;
    }

    default:
      console.log(`[Socket] Unknown role ${role} for ${userId}`);
  }
};

// ─────────────────────────────────────────────────────────────────────────
// Validate GPS coordinates
// ─────────────────────────────────────────────────────────────────────────
const isValidCoordinates = (lat, lng) => {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Handle location_update from driver
// ─────────────────────────────────────────────────────────────────────────
const handleLocationUpdate = async (socket, io, data) => {
  const { userId, role, schoolId, busId } = socket.user;

  // ── Role check ────────────────────────────────────────────────────
  if (role !== "driver") {
    return socket.emit("error", { message: "Only drivers can emit location updates." });
  }

  // ── Must have assigned bus ────────────────────────────────────────
  if (!busId) {
    return socket.emit("error", { message: "You are not assigned to any bus." });
  }

  // ── Validate coordinates ──────────────────────────────────────────
  const { lat, lng, speed } = data || {};

  if (!isValidCoordinates(lat, lng)) {
    return socket.emit("error", { message: "Invalid coordinates. lat must be -90 to 90, lng -180 to 180." });
  }

  // ── Rate limiting (3 sec minimum gap) ─────────────────────────────
  const now = Date.now();
  const lastEmit = lastEmitTimestamps[userId] || 0;

  if (now - lastEmit < MIN_UPDATE_INTERVAL_MS) {
    return; // silently drop — too frequent
  }
  lastEmitTimestamps[userId] = now;

  // ── Check active trip (in-memory cache first, DB fallback) ────────
  let tripId = socketManager.getActiveTrip(busId);

  if (!tripId) {
    // Cache miss — check DB
    const trip = await Trip.findOne({
      busId,
      driverId: userId,
      schoolId,
      status: TRIP_STATUS.ACTIVE
    }).lean();

    if (trip) {
      // Populate cache
      socketManager.addActiveTrip(busId, trip._id.toString());
      tripId = trip._id.toString();
    }
  }

  if (!tripId) {
    return socket.emit("error", { message: "No active trip. Start a trip before sending location." });
  }

  // ── Ensure driver is in the bus room ──────────────────────────────
  // Room gets cleared when a trip ends. If the driver started a new
  // trip without reconnecting, they need to rejoin the room.
  const busRoom = `bus_${busId}`;
  if (!socket.rooms.has(busRoom)) {
    socket.join(busRoom);
  }

  // ── Build location payload ──────────────────────────────────────
  const locationPayload = {
    busId,
    tripId,
    schoolId,
    lat,
    lng,
    speed: typeof speed === "number" ? speed : null,
    timestamp: new Date().toISOString()
  };

  // ── Store last known location in memory ─────────────────────────
  socketManager.setLastLocation(busId, locationPayload);

  // ── Broadcast to parents in the bus room ────────────────────────
  io.to(`bus_${busId}`).emit("location_update", locationPayload);

  // ── Broadcast to admins in the school room ──────────────────────
  io.to(`school_${schoolId}`).emit("bus_location_update", locationPayload);

  // ── Compute and broadcast ETA (throttled) ─────────────────────────
  const lastEtaCalcAt = lastEtaCalcTimestamps[busId] || 0;
  if (now - lastEtaCalcAt >= ETA_CALC_INTERVAL_MS) {
    lastEtaCalcTimestamps[busId] = now;
    try {
      const eta = await computeEtaForBus({
        schoolId,
        busId,
        origin: { lat, lng }
      });
      if (eta) {
        socketManager.setLatestEta(busId, eta);
        io.to(`bus_${busId}`).emit("eta_update", eta);
        io.to(`school_${schoolId}`).emit("eta_update", eta);
      }
    } catch (etaErr) {
      console.error("[Socket] ETA compute error:", etaErr.message);
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────
// Initialize Socket.IO
// ─────────────────────────────────────────────────────────────────────────
const initSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // Store io instance in singleton
  socketManager.setIO(io);

  // ── Hydrate in-memory cache with currently active trips ────────────
  Trip.find({ status: TRIP_STATUS.ACTIVE })
    .lean()
    .then((trips) => {
      trips.forEach((trip) => {
        socketManager.addActiveTrip(trip.busId.toString(), trip._id.toString());
      });
      console.log(`[Socket] Hydrated ${trips.length} active trip(s) into cache`);
    })
    .catch((err) => {
      console.error("[Socket] Failed to hydrate active trips cache:", err.message);
    });

  // ── Auth middleware ────────────────────────────────────────────────
  io.use(authenticateSocket);

  // ── Connection handler ────────────────────────────────────────────
  io.on("connection", (socket) => {
    console.log(`[Socket] Connected: ${socket.id} (${socket.user.role})`);

    // Join role-appropriate rooms
    joinRoomByRole(socket);

    // ── Driver: location_update listener ─────────────────────────────
    socket.on("location_update", async (data) => {
      try {
        await handleLocationUpdate(socket, io, data);
      } catch (err) {
        console.error("[Socket] location_update error:", err.message);
        socket.emit("error", { message: "Failed to process location update." });
      }
    });

    // ── Admin: request_all_locations listener ─────────────────────────
    // Admins can request a snapshot of all live bus locations on demand.
    socket.on("request_all_locations", () => {
      if (socket.user.role !== "admin") {
        return socket.emit("error", { message: "Only admins can request all locations." });
      }
      const liveLocations = socketManager.getAllLocationsForSchool(socket.user.schoolId);
      socket.emit("all_locations", liveLocations);
    });

    // ── Disconnect ───────────────────────────────────────────────────
    socket.on("disconnect", () => {
      console.log(`[Socket] Disconnected: ${socket.id} (${socket.user.role})`);

      // Clean up rate limit entry for drivers
      if (socket.user.role === "driver") {
        delete lastEmitTimestamps[socket.user.userId];
      }
    });
  });

  return io;
};

module.exports = initSocket;
