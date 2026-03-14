# Trips Module – Documented Issues

**Module path:** `bustracker-server/src/modules/trips`  
**Last updated:** From design critique (parent and general).

---

## 1. Parent response: missing `occupied` / `remaining` (vs API doc)

**Severity:** Medium  
**Type:** Doc/implementation mismatch

- **What:** API doc says parent `GET /api/trips/current` (active trip) response includes `occupied` and `remaining`. The controller never sets these for the parent response and populates `busId` with only `"busNumber"` (no `capacity`).
- **Where:** `trips.controller.js` – `currentTrip` handler.
- **Fix:** Either add `capacity` to the bus populate and set `trip.occupied` / `trip.remaining` before returning (to match doc), or update the API doc to remove these fields for the parent response.

---

## 2. No last-known location in GET /api/trips/current

**Severity:** Medium  
**Type:** UX / completeness

- **What:** When a trip is active, parents get trip metadata but no latest GPS position in the same response. They must wait for the next Socket.IO `location_update` to show the bus on the map on first load.
- **Where:** `trips.controller.js` – `currentTrip`.
- **Fix:** When an active trip exists, optionally include `lastLocation` (from `socketManager.getLastLocation(busId)`) in the response so the first paint can show the bus position without waiting for socket.

---

## 3. “No bus assigned” vs “No active trip” both return `NOT_RUNNING`

**Severity:** Low  
**Type:** API clarity

- **What:** When the parent has no bus assigned, the handler returns `data: { status: "NOT_RUNNING" }` with message “No bus assigned.” When the parent has a bus but no active trip, it also returns `data: { status: "NOT_RUNNING" }` with “No active trip for your bus.” The response body alone does not distinguish the two cases.
- **Where:** `trips.controller.js` – `currentTrip`.
- **Fix:** Either use a different status or add a field (e.g. `reason` or `noBusAssigned: true`) so the client can differentiate “not on any route” vs “your bus isn’t running right now.”

---

## 4. No “is my child on the bus?” flag for parents

**Severity:** Low  
**Type:** UX

- **What:** The response includes `students[]` (boarded users). The client must check whether the parent’s own id is in that list to know “is my child on the bus?”. No explicit flag like `isOnBus` in the payload.
- **Where:** `trips.controller.js` – `currentTrip` response shape.
- **Fix:** Add a boolean (e.g. `isOnBus`) derived from whether the current user’s id is in `trip.students` so the parent UI can show it without client-side logic.

---

## 5. No trip history for parents

**Severity:** Low  
**Type:** Feature gap

- **What:** Parents can only ask “current trip or not.” There is no endpoint to fetch past/completed trips for their bus (e.g. “when did today’s trip end?”).
- **Where:** Trips module – no parent-facing list/history endpoint.
- **Fix:** If product needs it, add e.g. `GET /api/trips/history` (parent, scoped to their bus) with optional date/limit and return completed trips.

---

## 6. Generic error handling in currentTrip

**Severity:** Low  
**Type:** Error handling

- **What:** On any exception, `currentTrip` returns `badRequest(res, "Failed to fetch current trip.")` (400). Real server/DB failures are indistinguishable from bad request.
- **Where:** `trips.controller.js` – `currentTrip` catch block.
- **Fix:** Return 500 (or use a generic server-error helper) for unexpected errors so clients and monitoring can treat them differently from validation/state errors.

---

## 7. Socket: bus assignment change requires reconnect

**Severity:** Low  
**Type:** Real-time / doc

- **What:** Parents join `bus_<busId>` only at socket connection time. If an admin assigns a parent to a bus after they are already connected, they do not join the new bus room until they reconnect.
- **Where:** `realtime/socket.js` – room join on connect only.
- **Fix:** Either document that “after bus assignment change, client should reconnect socket” or (larger change) support dynamic room join when user’s busId is updated (e.g. via an API or server-side user refresh).

---

## References

- API doc: `bustracker-server/API_DOCUMENTATION.md` (Trips, Real-Time Events).
- Controller: `bustracker-server/src/modules/trips/trips.controller.js`.
- Routes: `bustracker-server/src/modules/trips/trips.routes.js`.
