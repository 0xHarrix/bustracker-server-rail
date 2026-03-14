# Buses Module

**Path:** `bustracker-server/src/modules/buses`  
**Mount:** `app.use("/api/buses", busRoutes)` → base path **`/api/buses`**

---

## 1. Purpose & scope

- **Admin-only:** All routes use `authenticate` + `authorize("admin")`. All operations are scoped to `req.user.schoolId`.
- **Create bus:** Add bus (busNumber, optional capacity) to admin’s school. busNumber unique within school.
- **List buses / get bus:** List all buses in admin’s school with driver populated and occupancy (occupied, remaining); get one by id with students list (parents assigned to that bus).
- **Assign / unassign driver:** Set or clear bus.driverId and driver’s busId. Not allowed if bus has an active trip. One driver per bus; assigning a new driver unassigns the previous one.

---

## 2. File structure

| File | Role |
|------|------|
| `buses.controller.js` | createBus, getBuses, getBusById, assignDriver, unassignDriver |
| `buses.routes.js` | POST /, GET /, GET /:id, PATCH /:busId/assign-driver, PATCH /:busId/unassign-driver; all authenticate + authorize("admin") |
| `bus.model.js` | Bus schema (busNumber, schoolId, driverId, capacity, isActive); indexes (schoolId; schoolId+busNumber unique; driverId sparse) |

---

## 3. Dependencies

- **Models:** `Bus`, `User`, `Trip`; `TRIP_STATUS` from trips module.
- **Utils:** `success`, `created`, `badRequest`, `notFound`, `conflict` from `../../utils/response`.
- **Middleware:** `authenticate`, `authorize("admin")`.

---

## 4. APIs

### POST /api/buses

- **Auth:** Admin.
- **Body:** `{ busNumber [, capacity ] }`. busNumber required; capacity optional positive integer.
- **Flow:** Trim busNumber; check duplicate (schoolId + busNumber); create with schoolId from req.user, capacity or null. Return 201 with bus + occupied: 0, remaining: capacity. 409 on duplicate.

### GET /api/buses

- **Auth:** Admin.
- **Flow:** Find buses by req.user.schoolId; populate driverId (name, phone); sort createdAt desc. For **each** bus, count users (busId, schoolId, role parent, isActive true) → occupied; remaining = capacity - occupied (null if no capacity). Return array. **N+1:** one count per bus.

### GET /api/buses/:id

- **Auth:** Admin.
- **Flow:** Find bus by _id and schoolId; populate driverId. Fetch all users with that busId, schoolId, role parent (no isActive filter) → students; occupied = students.length; remaining = capacity - occupied. Return bus + students + occupied + remaining. **Note:** occupancy here can differ from list if inactive parents exist.

### PATCH /api/buses/:busId/assign-driver

- **Auth:** Admin.
- **Body:** `{ driverId }`.
- **Flow:** Validate busId, driverId; bus must exist in school and be active; no active trip on this bus; driver exists in school, role driver, active; driver not already assigned to another bus. Unassign previous driver from this bus (set their busId null) if any; set bus.driverId and driver’s busId; save. Return populated bus.

### PATCH /api/buses/:busId/unassign-driver

- **Auth:** Admin.
- **Body:** None.
- **Flow:** Bus must exist in school and have a driverId; no active trip. Set driver’s busId null and bus.driverId null; save. Return bus (driverId null).

---

## 5. Key logic

- **Scoping:** Every handler uses req.user.schoolId for Bus.find and User/Trip lookups.
- **Active trip block:** Assign and unassign driver both check Trip.findOne({ busId, status: ACTIVE }); if present, return 400 (cannot change driver while trip active).
- **One driver per bus:** Assign checks Bus.findOne({ schoolId, driverId, _id: { $ne: busId } }); if found, 409 “Driver already assigned to bus X”.
- **Occupancy:** List uses “active parents only” count; getById uses “all assigned parents” count → inconsistent definition. Capacity can be null; then remaining is null.

---

## 6. Integration

- **Users:** Assign/unassign driver updates User.busId for the driver. Users module assigns parents to buses (parent.busId); buses getBusById lists those parents as “students”.
- **Trips:** Reads Trip to ensure no active trip before driver assign/unassign. Does not create or end trips.
- **Real-time:** No direct socket usage in this module; driver’s busId is used by socket for room join and trip/location logic.

---

## 7. Data / model

- **Bus:** busNumber (required, trim), schoolId (required), driverId (ref User, default null), capacity (number, default null, min 1), isActive (default true), timestamps. Indexes: schoolId; (schoolId, busNumber) unique; driverId sparse.
- **Responses:** create returns bus + occupied, remaining; list and get add driverId populated (name, phone), occupied, remaining; getById also adds students array (parents on that bus). No update or deactivate endpoint.
