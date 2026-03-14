# Buses Module – Documented Issues

**Module path:** `bustracker-server/src/modules/buses`  
**Last updated:** From design critique.

---

## 1. Occupancy semantics: list vs get-by-id inconsistent

**Severity:** Medium  
**Type:** Data consistency

- **What:** `getBuses` (list) computes `occupied` as count of users with `busId`, `schoolId`, `role: "parent"`, and **`isActive: true`**. `getBusById` sets `students` to all users with `busId`, `schoolId`, `role: "parent"` (no `isActive` filter) and sets `occupied = students.length`. So for the same bus, list can show a different `occupied` than the detail view if there are inactive parents.
- **Where:** `buses.controller.js` – `getBuses` (lines ~79–87), `getBusById` (lines ~117–129).
- **Fix:** Use one definition of “occupied” (e.g. only active parents, or all assigned) and apply it in both list and get-by-id. If listing only active, filter `students` and occupancy in get-by-id the same way; document the choice in API doc.

---

## 2. N+1 queries in list buses

**Severity:** Medium  
**Type:** Performance

- **What:** For each bus in `getBuses`, the code runs a separate `User.countDocuments({ busId, schoolId, role: "parent", isActive: true })`. With many buses, this does N+1 queries.
- **Where:** `buses.controller.js` – `getBuses` loop.
- **Fix:** Use one aggregation (e.g. `User.aggregate` with `$match` by schoolId, role, isActive and `$group` by busId with `$count`) or a single query that returns counts per busId, then attach counts to the bus list in memory.

---

## 3. No update bus (PATCH)

**Severity:** Low  
**Type:** API completeness

- **What:** There is no endpoint to update a bus (e.g. change `busNumber` or `capacity`). Corrections require DB access or a new endpoint.
- **Where:** `buses.routes.js` – no PATCH route; controller has no update handler.
- **Fix:** Add e.g. `PATCH /api/buses/:id` (admin, scoped to school) with optional `busNumber`, `capacity`, validate uniqueness for busNumber within school, and document in API doc.

---

## 4. No deactivate bus

**Severity:** Low  
**Type:** API completeness

- **What:** The model has `isActive` but no API to set it. Admins cannot “retire” a bus via the API. Assign-driver already rejects inactive buses.
- **Where:** `bus.model.js` has `isActive`; no controller/route to update it.
- **Fix:** Add an endpoint to set `isActive` (e.g. `PATCH /api/buses/:id` with `isActive: false/true`), or include it in the update endpoint above. Document behavior (e.g. cannot assign driver to inactive bus).

---

## 5. Unassign driver response shape

**Severity:** Low  
**Type:** API consistency

- **What:** `unassignDriver` returns `success(res, bus, ...)` where `bus` is the in-memory document after clearing `driverId`. The API doc does not show the exact response body; if clients expect a populated or consistent shape (e.g. same as assign response), it may need alignment.
- **Where:** `buses.controller.js` – `unassignDriver` return.
- **Fix:** Document the unassign response (e.g. `data: { _id, busNumber, driverId: null, ... }`) and, if desired, populate or shape the bus object consistently with other bus responses.

---

## References

- API doc: `bustracker-server/API_DOCUMENTATION.md` (Buses).
- Controller: `bustracker-server/src/modules/buses/buses.controller.js`.
- Model: `bustracker-server/src/modules/buses/bus.model.js`.
- Routes: `bustracker-server/src/modules/buses/buses.routes.js`.
