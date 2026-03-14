# Trips Module

**Path:** `bustracker-server/src/modules/trips`  
**Mount:** `app.use("/api/trips", tripRoutes)` → base path **`/api/trips`**

---

## 1. Purpose & scope

- **Roles:** Driver (start/end trip, board/unboard students); Parent (get current trip for their bus); Admin (list all trips in school, get trip by id).
- **Trip lifecycle:** One active trip per bus (DB unique partial index). Trip has busId, driverId, schoolId, startTime, endTime, status (ACTIVE | COMPLETED), students[] (ObjectIds of boarded parents). Students start empty; driver boards at stops via board endpoint.
- **Real-time:** Controller emits `trip_started` and `trip_ended` to Socket.IO rooms (`bus_<busId>`, `school_<schoolId>`). Location updates are emitted by the driver via socket (handled in realtime/socket.js), not in this controller.

---

## 2. File structure

| File | Role |
|------|------|
| `trips.controller.js` | startTrip, endTrip, currentTrip, boardStudents, unboardStudents, getTrips, getTripById |
| `trips.routes.js` | All routes use authenticate; then role-specific: driver (start, end, board, unboard), parent (GET /current), admin (GET /, GET /:id). Order: /start, /end, /current/board, /current/unboard, /current, /, /:id |
| `trip.model.js` | Trip schema; TRIP_STATUS; indexes (busId+status, schoolId+status, unique partial busId where status=ACTIVE) |

---

## 3. Dependencies

- **Models:** `Trip`, `Bus`, `User`; `TRIP_STATUS` from own model.
- **Utils:** `success`, `badRequest`, `notFound`, `conflict` from `../../utils/response`.
- **Real-time:** `socketManager` (getIO, addActiveTrip, removeActiveTrip) from `../../realtime/socketManager`.
- **Middleware:** `authenticate`, `authorize("driver" | "parent" | "admin")` per route.

---

## 4. APIs

### POST /api/trips/start (Driver)

- **Auth:** Driver. Uses req.user.busId (assigned bus).
- **Body:** None.
- **Flow:** Ensure driver has busId; bus exists, active, and driverId matches; no existing ACTIVE trip for this bus (application check + DB unique index). Create trip: busId, driverId, schoolId, startTime now, status ACTIVE, students []. Sync socketManager.addActiveTrip(busId, tripId). Emit `trip_started` to bus_<busId> and school_<schoolId>. Return 201 with trip.

### POST /api/trips/end (Driver)

- **Auth:** Driver.
- **Body:** None.
- **Flow:** Find ACTIVE trip for this driver’s bus; set status COMPLETED, endTime now; save. Clear currentBusId for all users in trip.students; socketManager.removeActiveTrip(busId); emit `trip_ended` to bus_ and school_ rooms; then io.in(busRoom).socketsLeave(busRoom). Return completed trip (populated busId, driverId, students).

### GET /api/trips/current (Parent)

- **Auth:** Parent. Uses req.user.busId (permanent route).
- **Body:** None.
- **Flow:** If no busId → 200 { status: "NOT_RUNNING" } “No bus assigned.” Else find ACTIVE trip for that busId and schoolId; populate busId (busNumber), driverId (name, phone), students (name, phone, rollNumber). If no trip → 200 { status: "NOT_RUNNING" } “No active trip for your bus.” Else return trip. **Note:** Response does not currently set occupied/remaining or include lastLocation; see issues.

### POST /api/trips/current/board (Driver)

- **Auth:** Driver.
- **Body:** `{ studentId }` or `{ studentIds: [...] }`.
- **Flow:** Resolve to array of ids; find ACTIVE trip for driver’s bus; validate ids as parents in same school with busId = this bus, active; $addToSet trip.students; set currentBusId for those users. Return trip with populated busId, driverId, students and occupied/remaining.

### POST /api/trips/current/unboard (Driver)

- **Auth:** Driver.
- **Body:** `{ studentId }` or `{ studentIds: [...] }`.
- **Flow:** Find ACTIVE trip; $pull students; set currentBusId null for those users. Return updated trip with occupied/remaining.

### GET /api/trips (Admin)

- **Auth:** Admin.
- **Query:** `status` (optional): ACTIVE | COMPLETED.
- **Flow:** Filter by req.user.schoolId and optional status; find trips, populate busId (busNumber, capacity), driverId (name, phone); sort createdAt desc; attach occupied (students.length) and remaining per trip. Return array.

### GET /api/trips/:id (Admin)

- **Auth:** Admin.
- **Flow:** Find trip by _id and schoolId; populate busId, driverId, students (name, phone, rollNumber, isActive); set occupied, remaining. 404 if not in school. Return trip.

---

## 5. Key logic

- **One active trip per bus:** Enforced by unique partial index on { busId } where status = ACTIVE. startTrip also checks in app and handles 11000 on race.
- **Board/unboard:** Only parents with busId = this bus (same school) can be added. Trip.students and User.currentBusId are kept in sync. End trip clears all currentBusId for trip.students; busId (permanent route) is unchanged.
- **Socket cache:** socketManager.activeTrips maps busId → tripId for fast lookup on location_update (realtime/socket.js). addActiveTrip/removeActiveTrip called on start/end. lastLocations cleared for bus on trip end.
- **Parent current trip:** No schoolId in request; uses req.user.busId and req.user.schoolId from JWT. Only returns active trip for that bus.

---

## 6. Integration

- **Users:** Updates User.currentBusId on board/unboard and on trip end (bulk clear). Reads User for board validation (parent, busId, schoolId, isActive).
- **Buses:** Reads Bus (driver’s bus, active). Does not create buses or assign drivers.
- **Socket:** Emits trip_started, trip_ended. Does not handle location_update (that is in realtime/socket.js; driver emits, server broadcasts to bus_ and school_ rooms using socketManager.lastLocations and getActiveTrip).
- **socketManager:** addActiveTrip(busId, tripId), removeActiveTrip(busId), getIO(). Used so realtime layer can validate active trip and broadcast locations.

---

## 7. Data / model

- **Trip:** busId, driverId, schoolId (required); startTime, endTime (Date); status ACTIVE | COMPLETED; students (array of ObjectId ref User). Indexes: (busId, status), (schoolId, status), unique partial (busId where status=ACTIVE).
- **Responses:** Driver endpoints return trip with populated busId/driverId/students and computed occupied/remaining. Parent current returns trip or { status: "NOT_RUNNING" }. Admin list returns array with occupancy; admin get returns one trip with full students.
