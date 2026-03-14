# Auth Module

**Path:** `bustracker-server/src/modules/auth`  
**Mount:** `app.use("/api/auth", authRoutes)` → base path **`/api/auth`**

---

## 1. Purpose & scope

- **Login:** Authenticate by `schoolCode` + `identifier` (phone or rollNumber) + password (or OTP when enabled). Return JWT and user summary.
- **Get current user:** Return the authenticated user’s full profile from DB (used after `authenticate` middleware).
- **No logout:** Stateless JWT; client discards token for “logout”.

---

## 2. File structure

| File | Role |
|------|------|
| `auth.controller.js` | `login`, `me`; strategy resolution; credential validation; JWT payload build |
| `auth.routes.js` | `POST /login` (public), `GET /me` (authenticate) |
| `otp.model.js` | OTP schema (phone, otp, expiresAt, attempts); TTL index |
| `otp.service.js` | `generateOtp(phone)`, `verifyOtp(phone, code)` — not wired into login yet |

---

## 3. Dependencies

- **Models:** `User`, `School` (auth); `OTP` (scaffold).
- **Utils:** `signToken`, `verifyToken` from `../../utils/jwt`; `comparePassword` from `../../utils/password`; `success`, `badRequest`, `unauthorized`, `notFound` from `../../utils/response`.
- **Middleware:** `authenticate` (for `/me` only). Login has no auth.

---

## 4. APIs

### POST /api/auth/login

- **Auth:** None (public).
- **Body:** `{ schoolCode, identifier, password? }` or `{ schoolCode, identifier, otp? }`.
  - `schoolCode` – required; trimmed and uppercased.
  - `identifier` – required; phone **or** rollNumber (trimmed only; phone not normalized like in users module).
  - `password` – required for password strategy.
  - `otp` – for OTP strategy (currently returns “OTP login is not yet enabled.”).
- **Flow:**
  1. Validate `schoolCode`, `identifier`.
  2. Find school by `schoolCode` with `isActive: true`. If not found → 404 “School not found or is inactive.”
  3. Find user in that school by `$or: [{ phone: trimmedIdentifier }, { rollNumber: trimmedIdentifier }]`. If not found → 401 “Invalid credentials.”
  4. If user inactive → 401 “Account has been deactivated. Contact your school admin.”
  5. Resolve strategy (body.otp ? OTP : PASSWORD). Validate credentials (password compare or OTP verify). If invalid → 401 with message.
  6. Build JWT payload: `{ userId, role, schoolId, busId }`. Sign with 7d expiry.
  7. Return 200: `{ success, message, data: { token, user: { id, name, role, phone, rollNumber, schoolId, busId, currentBusId } } }`.
- **Errors:** 400 missing/invalid input; 404 school not found; 401 invalid credentials / deactivated.

### GET /api/auth/me

- **Auth:** Required (`Authorization: Bearer <token>`). Uses `authenticate` middleware.
- **Body:** None.
- **Flow:** Load user by `req.user.userId` from JWT, `select("-password")`, `populate("schoolId", "name schoolCode")`, lean. If not found → 404. Return 200 with full user object (no password).
- **Use:** Downstream code gets fresh user from DB; JWT is only used to identify the user.

---

## 5. Key logic

- **Strategy:** `resolveStrategy(body)` → PASSWORD if no `body.otp`, else OTP. `validateCredentials(strategy, user, body)` runs password compare or OTP verify; returns `{ valid, message }`.
- **JWT payload:** `buildTokenPayload(user)` → `{ userId, role, schoolId, busId }`. Used by `authenticate` middleware and Socket.IO; never includes password.
- **Identifier:** Login matches user by **phone** or **rollNumber** in the school; identifier is only trimmed, not normalized for phone (unlike user creation which uses `normalizePhone`).

---

## 6. Integration

- **Middleware:** `authenticate` (in `src/middlewares/auth.middleware.js`) uses the same JWT verify and loads user by `decoded.userId`; attaches `req.user = { userId, role, schoolId, busId, currentBusId }`. Used by all other modules for protected routes.
- **Socket:** Socket auth uses `socket.handshake.auth.token` and the same JWT verify; then loads user and attaches `socket.user` with the same shape for room assignment and events.

---

## 7. Data / responses

- **Login success:** `data.user` has `id` (ObjectId), `name`, `role`, `phone`, `rollNumber`, `schoolId` (string), `busId`, `currentBusId` (strings or null). No password.
- **Me:** Full user document (lean, no password), with `schoolId` populated as `{ _id, name, schoolCode }`.
