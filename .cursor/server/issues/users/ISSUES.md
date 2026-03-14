# Users Module – Documented Issues

**Module path:** `bustracker-server/src/modules/users`  
**Last updated:** From design critique.

---

## 1. Create user: schoolId from request body (cross-school)

**Severity:** High  
**Type:** Security

- **What:** `createUser` takes `schoolId` from **req.body** and never checks that it equals **req.user.schoolId**. Any admin (e.g. of school A) can create users, including another admin, in any other school (e.g. school B). This breaks the “admin only manages their own school” guarantee and is a privilege-escalation hole.
- **Where:** `users.controller.js` – `createUser` (lines ~36–41, 107).
- **Fix:** For school-scoped admins, ignore client `schoolId` and use only `req.user.schoolId` when creating the user. If you later add a super-admin role, that role could be the exception allowed to pass a schoolId in the body (with explicit checks).

---

## 2. Create user: busId not validated to same school

**Severity:** High  
**Type:** Data integrity

- **What:** When `busId` is provided in create user, the code only checks that it is a valid ObjectId. It does not verify that the bus belongs to the same school as the user being created (the `schoolId` in the body). An admin could create a user in school A with `busId` pointing to a bus in school B, creating a cross-school reference.
- **Where:** `users.controller.js` – `createUser` (busId validation and User.create).
- **Fix:** When `busId` is present, load the bus with the same school as the new user, e.g. `Bus.findOne({ _id: busId, schoolId })` (using the schoolId used for the new user). If not found, return 400 (e.g. “Bus not found in this school.”).

---

## 3. No update user (PATCH)

**Severity:** Medium  
**Type:** API completeness

- **What:** There is no endpoint to update a user (e.g. change name, phone, rollNumber, password, or role). Typos or password changes require DB access or a new endpoint.
- **Where:** `users.routes.js` – no PATCH for `/api/users/:id` (other than assign-bus / unassign-bus); controller has no update handler.
- **Fix:** Add e.g. `PATCH /api/users/:id` (admin, scoped to school) with optional fields; validate uniqueness for phone/rollNumber within school; hash password if provided; document in API doc.

---

## 4. No deactivate / reactivate user

**Severity:** Medium  
**Type:** API completeness

- **What:** The model has `isActive`; login and assign-bus already respect it. There is no API to set `isActive: false` or to reactivate a user. Admins cannot disable a user without DB access.
- **Where:** `user.model.js` has `isActive`; no controller/route to update it.
- **Fix:** Add an endpoint to set `isActive` (e.g. in `PATCH /api/users/:id` or a dedicated deactivate/reactivate). Document that inactive users cannot log in or be assigned to a bus.

---

## 5. Create user response: password

**Severity:** Low  
**Type:** Defensive practice

- **What:** The controller returns the document from `User.create()`. The schema’s `toJSON` strips `password`, so the HTTP response should not expose it. Relying solely on that is fine, but returning an explicit sanitized object (e.g. convert to object and delete `password`) would make the intent clear and avoid risk if the response path ever bypasses `toJSON`.
- **Where:** `users.controller.js` – `createUser` return.
- **Fix:** Before returning, ensure the user object sent in the response does not include `password` (e.g. `user.toObject(); delete obj.password` or use `select("-password")` on a refetch).

---

## 6. Bulk assign: inconsistent “failed” item shape

**Severity:** Low  
**Type:** API consistency

- **What:** Failed items are pushed as `{ userId, reason }` for “not found” and “invalid id”, and `{ userId, name, reason }` for role/isActive. The `failed` array therefore has two shapes. The API doc shows only `{ userId, reason }`.
- **Where:** `users.controller.js` – `bulkAssignBus` (results.failed.push(...)).
- **Fix:** Normalize to one shape (e.g. always include `name` when available) and document it in the API doc.

---

## 7. List users: no pagination

**Severity:** Low  
**Type:** Scalability

- **What:** `getUsers` returns all users in the school with no limit or pagination. Acceptable for small schools; for large ones it may be slow or heavy.
- **Where:** `users.controller.js` – `getUsers`.
- **Fix:** Add optional query params (e.g. `page`, `limit` or `cursor`) and document in API doc. Alternatively document that the endpoint returns all users and add a cap or pagination later when needed.

---

## References

- API doc: `bustracker-server/API_DOCUMENTATION.md` (Users).
- Controller: `bustracker-server/src/modules/users/users.controller.js`.
- Model: `bustracker-server/src/modules/users/user.model.js`.
- Routes: `bustracker-server/src/modules/users/users.routes.js`.
