# Schools Module – Documented Issues

**Module path:** `bustracker-server/src/modules/schools`  
**Last updated:** From design critique.

---

## 1. No school-level isolation for list and get

**Severity:** High (design ambiguity)  
**Type:** Security / consistency

- **What:** Buses, users, and trips are scoped by the admin’s school (`req.user.schoolId`). Schools are not: `getSchools` is `School.find()` with no filter, and `getSchoolById` is `School.findById(id)` with no schoolId check. So any admin (e.g. of school “DPS01”) can list and open every school in the system.
- **Where:** `schools.controller.js` – `getSchools`, `getSchoolById`.
- **Fix:** Decide and document: **(a)** Scope list/get to `req.user.schoolId` so admins only see their own school (e.g. list returns one school, get returns 404 if id !== admin’s school). **(b)** Keep global and explicitly document in API doc that school endpoints are platform-wide (any admin can list/view all schools). Implement (a) or (b) and update API doc and multi-school isolation section.

---

## 2. No update school (PATCH)

**Severity:** Low  
**Type:** API completeness

- **What:** There is no endpoint to update a school (e.g. change `name` or `schoolCode`). Corrections require DB access or a new endpoint.
- **Where:** `schools.routes.js` – no PATCH route; controller has no update handler.
- **Fix:** Add e.g. `PATCH /api/schools/:id` (admin) with optional `name`, `schoolCode`; validate uniqueness for schoolCode; consider whether only “platform” admins can update any school if you keep global list/get.

---

## 3. No deactivate school

**Severity:** Low  
**Type:** API completeness

- **What:** The model has `isActive` and login already uses it (`School.findOne({ schoolCode, isActive: true })`). There is no API to set `isActive: false` (or true again). You cannot “turn off” a school via the API.
- **Where:** `school.model.js` has `isActive`; no controller/route to update it.
- **Fix:** Add an endpoint to set `isActive` (e.g. in `PATCH /api/schools/:id` or a dedicated deactivate/reactivate). Document that inactive schools cannot be used for login.

---

## 4. Require inside handler (getSchoolById)

**Severity:** Low  
**Type:** Code quality

- **What:** In `getSchoolById`, `const mongoose = require("mongoose");` is inside the handler. It works but is inconsistent (other modules require at top) and slightly wasteful.
- **Where:** `schools.controller.js` – `getSchoolById`.
- **Fix:** Move `require("mongoose")` to the top of the file with other requires.

---

## 5. Create school and “who is this admin?”

**Severity:** Low  
**Type:** Documentation

- **What:** `createSchool` does not use `req.user.schoolId`; any admin can create a new school. That fits a “platform” or “first-time setup” model but is ambiguous if every admin is otherwise scoped to a single school. The doc does not state whether school create is platform-wide or restricted.
- **Where:** `schools.controller.js` – `createSchool`; API doc.
- **Fix:** Document the intended model: e.g. “Any admin can create a school (platform-wide); list/get may be scoped or global per decision in issue #1.”

---

## 6. Name validation

**Severity:** Low  
**Type:** Validation

- **What:** `name` is only checked for truthiness; the schema trims but does not enforce min/max length or format. Very long names or whitespace-only could be stored unless validated elsewhere.
- **Where:** `school.model.js`, `schools.controller.js` – createSchool.
- **Fix:** Add schema constraints (e.g. minlength, maxlength) and/or controller validation for `name` to match product rules.

---

## References

- API doc: `bustracker-server/API_DOCUMENTATION.md` (Schools, Multi-School Isolation).
- Controller: `bustracker-server/src/modules/schools/schools.controller.js`.
- Model: `bustracker-server/src/modules/schools/school.model.js`.
- Routes: `bustracker-server/src/modules/schools/schools.routes.js`.
