# Auth Module – Documented Issues

**Module path:** `bustracker-server/src/modules/auth`  
**Last updated:** From design critique.

---

## 1. Identifier normalization (phone) not aligned with users module

**Severity:** High  
**Type:** Correctness / UX

- **What:** In the users module, phone is normalized with `normalizePhone()` (strip everything except digits and leading `+`) before storing. In login, the identifier is only `trim()`ed; the same normalization is not applied when matching by phone. So a user created with stored phone `+919876543210` may fail to log in with `+91 9876543210` or `919876543210` because the lookup uses `trimmedIdentifier` as-is.
- **Where:** `auth.controller.js` – `login` (identifier handling and User.findOne $or for phone / rollNumber).
- **Fix:** When matching by phone, use the same normalization as in user creation (e.g. a shared `normalizePhone(trimmedIdentifier)` for the phone branch of the `$or`). Keep rollNumber as trimmed only, unless roll numbers are normalized elsewhere.

---

## 2. School existence leakage

**Severity:** Low  
**Type:** Information disclosure

- **What:** If the school is not found (or inactive), the API returns “School not found or is inactive.” (404). If the user is not found or the password is wrong, it returns “Invalid credentials.” (401). So an attacker can distinguish “this school code exists (and is active)” from “this school code does not exist or is inactive.”
- **Where:** `auth.controller.js` – `login` (school lookup vs user lookup / password validation).
- **Fix:** If school enumeration is a concern, consider returning a generic message (e.g. “Invalid credentials.”) for both invalid school code and invalid user/password, and use the same status code. Document the trade-off (usability vs enumeration).

---

## 3. No rate limiting or lockout on login

**Severity:** Medium  
**Type:** Security

- **What:** The login endpoint has no rate limiting or account lockout. An attacker can attempt many passwords (or identifiers) without backoff or lockout. The OTP service has an attempt limit per OTP, but password login does not.
- **Where:** `auth.controller.js` – `login`; no rate-limit middleware on the login route.
- **Fix:** Add rate limiting (e.g. per IP or per identifier) and/or lockout after N failed attempts (e.g. per schoolCode+identifier). Apply middleware to `POST /api/auth/login` or implement in the controller with a small store/cache.

---

## 4. Login error returns 400 for server/DB errors

**Severity:** Low  
**Type:** Error handling

- **What:** On any unexpected error in login, the catch block returns `badRequest(res, "Login failed. Please try again.")` (400). Real server or DB failures are indistinguishable from client errors, which complicates monitoring and client behavior.
- **Where:** `auth.controller.js` – `login` catch block.
- **Fix:** Return 500 (or use a generic server-error response) for unexpected errors so clients and monitoring can treat them differently from validation or auth failures.

---

## 5. JWT_SECRET not validated at startup

**Severity:** Low  
**Type:** Operations / robustness

- **What:** `jwt.sign` and `jwt.verify` use `process.env.JWT_SECRET`. If it is unset, behavior is undefined (or may throw). Validation at app startup is not in this module but is a deployment concern.
- **Where:** `utils/jwt.js`; app entrypoint or config.
- **Fix:** In app startup or config (e.g. `config/env.js`), require `JWT_SECRET` to be set and fail fast with a clear message if missing.

---

## 6. No logout or token invalidation

**Severity:** Low  
**Type:** Design choice

- **What:** Auth is stateless JWT; there is no blacklist or logout endpoint. “Logout” is client-side (discard token). The token is valid until expiry (7 days). There is no refresh token.
- **Where:** Auth module and JWT usage.
- **Fix:** If acceptable, document that logout is client-side and tokens are valid until expiry. If you need server-side invalidation, add a logout that invalidates the token (e.g. blacklist or short-lived token + refresh flow).

---

## 7. Login response: user.id type

**Severity:** Low  
**Type:** API consistency

- **What:** The code sets `user.id: user._id` (Mongoose ObjectId). The API doc shows a string. When serialized to JSON it usually becomes a string; if the client expects a string explicitly, the type may be ambiguous.
- **Where:** `auth.controller.js` – `login` response object.
- **Fix:** Use `user._id.toString()` for `id` in the response so the contract is clearly a string and matches the doc.

---

## 8. OTP not integrated

**Severity:** Low  
**Type:** Feature completeness

- **What:** OTP model and service exist and are implemented, but the controller has OTP integration commented out. When the client sends `otp`, the login returns “OTP login is not yet enabled.” So OTP is scaffold only.
- **Where:** `auth.controller.js` – OTP service require and `validateCredentials` OTP case.
- **Fix:** When enabling OTP: wire in `otpService.verifyOtp`, ensure identifier (phone) is normalized for OTP lookup, and document the OTP login flow in the API doc.

---

## References

- API doc: `bustracker-server/API_DOCUMENTATION.md` (Authentication).
- Controller: `bustracker-server/src/modules/auth/auth.controller.js`.
- Routes: `bustracker-server/src/modules/auth/auth.routes.js`.
- OTP: `auth/otp.model.js`, `auth/otp.service.js`.
- JWT: `bustracker-server/src/utils/jwt.js`.
- Password: `bustracker-server/src/utils/password.js`.
