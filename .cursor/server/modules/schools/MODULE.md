# Schools Module

**Path:** `bustracker-server/src/modules/schools`  
**Mount:** `app.use("/api/schools", schoolRoutes)` → base path **`/api/schools`**

---

## 1. Purpose & scope

- **Admin-only:** All routes use `authenticate` + `authorize("admin")`.
- **Create school:** Add a new school (name, schoolCode). Any admin can create; no use of `req.user.schoolId`.
- **List schools:** Returns **all** schools in the system (no filter by admin’s school).
- **Get school by ID:** Returns any school by id (no check that id === admin’s school). So schools are effectively “platform-wide” for admins; buses/users/trips are scoped per school elsewhere.

---

## 2. File structure

| File | Role |
|------|------|
| `schools.controller.js` | createSchool, getSchools, getSchoolById |
| `schools.routes.js` | POST /, GET /, GET /:id; all with authenticate + authorize("admin") |
| `school.model.js` | School schema (name, schoolCode, isActive); schoolCode unique, uppercase, length 2–20 |

---

## 3. Dependencies

- **Models:** `School` only.
- **Utils:** `success`, `created`, `badRequest`, `notFound`, `conflict` from `../../utils/response`.
- **Middleware:** `authenticate`, `authorize("admin")`. Note: getSchoolById uses `require("mongoose")` inside the handler (should be at top).

---

## 4. APIs

### POST /api/schools

- **Auth:** Admin.
- **Body:** `{ name, schoolCode }`. Both required. `schoolCode` is trimmed and uppercased.
- **Flow:** Check duplicate schoolCode (findOne); create school with name trimmed, schoolCode normalized. Return 201 with created document. On unique violation → 409.

### GET /api/schools

- **Auth:** Admin.
- **Flow:** `School.find()` no filter; sort by createdAt desc; return array. **Not scoped** to req.user.schoolId.

### GET /api/schools/:id

- **Auth:** Admin.
- **Flow:** Validate ObjectId; findById(id); 404 if not found. **No** schoolId filter. Return school.

---

## 5. Key logic

- **Uniqueness:** schoolCode is unique globally (schema + index). Duplicate check before create; 11000 handled on race.
- **Inactive:** Model has `isActive` (default true). Login (auth) uses `isActive: true` when finding school; no API in this module to update isActive.
- **No update / no deactivate:** No PATCH or delete; cannot change name/schoolCode or set isActive via this module.

---

## 6. Integration

- **Auth:** Login finds school by schoolCode and isActive; uses school._id as user’s schoolId.
- **Users:** Create user accepts schoolId; users module looks up School by that id for validation. Schools module does not reference users.
- **Buses / Trips:** Reference schoolId; no direct dependency from schools module to them.

---

## 7. Data / model

- **School:** name (required, trim), schoolCode (required, unique, uppercase, trim, 2–20 chars), isActive (default true), timestamps.
- **Responses:** Plain school document; list and get return same shape (no extra fields).
