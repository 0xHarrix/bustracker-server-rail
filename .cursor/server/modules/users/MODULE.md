# Users Module

**Path:** `bustracker-server/src/modules/users`  
**Mount:** `app.use("/api/users", userRoutes)` → base path **`/api/users`**

---

## 1. Purpose & scope

- **Admin-only:** All routes use `authenticate` + `authorize("admin")`. Every operation is intended to be scoped to the admin’s school via `req.user.schoolId` (except create user — see issues).
- **Create user:** Add admin, driver, or parent to a school (body currently includes `schoolId` and optional `busId`; no check that body schoolId === req.user.schoolId).
- **List / get user:** List users in admin’s school (optional `role` filter); get one by id (must be in admin’s school).
- **Assign / unassign bus:** Set or clear a parent’s permanent route (`busId`); sync with active trip (board/unboard) when relevant. Bulk assign up to 100 parents to one bus.

---

## 2. File structure

| File | Role |
|------|------|
| `users.controller.js` | createUser, getUsers, getUserById, assignBus, unassignBus, bulkAssignBus; getBusOccupancy helper |
| `users.routes.js` | All routes under authenticate + authorize("admin"); order: POST /, GET /, PATCH /bulk-assign-bus, GET /:id, PATCH /:id/assign-bus, PATCH /:id/unassign-bus |
| `user.model.js` | User schema (name, phone, rollNumber, password, role, schoolId, busId, currentBusId, isActive); indexes; toJSON strips password |

---

## 3. Dependencies

- **Models:** `User`, `School`, `Bus`, `Trip`; `TRIP_STATUS` from trips module.
- **Utils:** `hashPassword` from `../../utils/password`; `success`, `created`, `badRequest`, `notFound`, `conflict` from `../../utils/response`.
- **Middleware:** `authenticate`, `authorize("admin")`.

---

## 4. APIs

### POST /api/users

- **Auth:** Admin.
- **Body:** `{ name, role, schoolId [, phone, rollNumber, password, busId ] }`. `name`, `role`, `schoolId` required. Parent must have at least one of `phone`, `rollNumber`. `schoolId` and `busId` come from body (no check that schoolId === req.user.schoolId; busId not validated to belong to schoolId).
- **Flow:** Validate; find school (exists, active); normalize phone (same as used in login for uniqueness); check phone/rollNumber unique within school; hash password; create user. Return 201 with user (toJSON strips password). On duplicate key → 409.
- **Scoping:** Currently **not** restricted to admin’s school; any admin can create users in any school.

### GET /api/users

- **Auth:** Admin.
- **Query:** `role` (optional): `"admin"` \| `"driver"` \| `"parent"`.
- **Flow:** Filter by `req.user.schoolId` and optional role; find, select -password, sort by createdAt desc; return array. No pagination.

### GET /api/users/:id

- **Auth:** Admin.
- **Flow:** Find one by `_id` and `req.user.schoolId`; select -password. 404 if not in school. Return user.

### PATCH /api/users/:id/assign-bus

- **Auth:** Admin.
- **Body:** `{ busId }`.
- **Flow:** Validate ids; get user and bus in admin’s school; user must be parent and active; bus must be active. Remove user from any current trip (currentBusId) and from old bus’s active trip if switching; set user.busId; if this bus has active trip, add user to trip.students and set user.currentBusId; save. Return user + busOccupancy { occupied, capacity, remaining }.

### PATCH /api/users/:id/unassign-bus

- **Auth:** Admin.
- **Body:** None.
- **Flow:** User must be in school and have busId; remove from active trip (pull from trip.students), set busId and currentBusId null; save. Return user + busOccupancy for the bus they were removed from.

### PATCH /api/users/bulk-assign-bus

- **Auth:** Admin.
- **Body:** `{ busId, userIds }`. Max 100 userIds.
- **Flow:** Validate bus in school and active; for each userId validate in school, parent, active; remove from old trip if any, set busId, save; collect assigned/failed. If bus has active trip, batch update currentBusId and add to trip.students for all assigned. Return { assigned, failed, busOccupancy }; failed items have mixed shape (userId+reason or userId+name+reason).

---

## 5. Key logic

- **Scoping:** List, get, assign, unassign, bulk-assign all use `req.user.schoolId`. Create uses `req.body.schoolId` and does not validate busId against that school.
- **Phone:** `normalizePhone(phone)` strips non-digits except leading `+`; used for create and uniqueness checks. Login (auth module) does not use this for identifier.
- **Bus occupancy:** `getBusOccupancy(busId, schoolId)` returns `{ occupied }` (count of parents with that busId, same school, role parent, isActive true). Callers attach capacity/remaining from bus doc.
- **Trip sync:** Assign/unassign and bulk-assign update Trip.students and User.currentBusId when the target bus has an active trip; they also remove users from previous bus’s active trip when switching.

---

## 6. Integration

- **Trips:** Reads/updates Trip (active trip lookup, $pull/$addToSet students, currentBusId). Does not start/end trips.
- **Buses:** Reads Bus (exists, schoolId, isActive, capacity). Does not create buses or assign drivers.
- **Schools:** Reads School (exists, isActive) for create user only.
- **Auth:** No direct dependency; JWT payload (role, schoolId, busId) is set at login; user profile used by /me and middleware.

---

## 7. Data / model

- **User:** name, phone, rollNumber (optional), password (optional), role (admin|driver|parent), schoolId (required), busId (permanent route), currentBusId (currently boarded), isActive, timestamps. Indexes: (schoolId, phone), (schoolId, rollNumber) unique sparse; (schoolId, role); (currentBusId) sparse.
- **Responses:** User objects never include password (select("-password") or toJSON). Assign/unassign return `user` + `busOccupancy`. Create returns full user (relies on toJSON for password strip).
