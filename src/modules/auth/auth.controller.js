const mongoose = require("mongoose");
const User = require("../users/user.model");
const School = require("../schools/school.model");
const { signToken } = require("../../utils/jwt");
const { comparePassword } = require("../../utils/password");
const { success, badRequest, unauthorized, notFound } = require("../../utils/response");
// const otpService = require("./otp.service"); // uncomment when OTP is enabled

// ── Validation strategy enum ────────────────────────────────────────────
const AUTH_STRATEGY = {
  PASSWORD: "password",
  OTP: "otp"
};

/**
 * Determine which authentication strategy to use.
 * Currently defaults to PASSWORD. When OTP is enabled,
 * this can check for the presence of `otp` in the body.
 */
const resolveStrategy = (body) => {
  if (body.otp) {
    return AUTH_STRATEGY.OTP;
  }
  return AUTH_STRATEGY.PASSWORD;
};

/**
 * Validate credentials based on the active strategy.
 *
 * @param {string} strategy - AUTH_STRATEGY value
 * @param {object} user     - The user document (with password)
 * @param {object} body     - The request body
 * @returns {Promise<{ valid: boolean, message: string }>}
 */
const validateCredentials = async (strategy, user, body) => {
  switch (strategy) {
    case AUTH_STRATEGY.PASSWORD: {
      if (!body.password) {
        return { valid: false, message: "Password is required." };
      }
      if (!user.password) {
        return { valid: false, message: "Password login is not enabled for this account. Use OTP." };
      }
      const isMatch = await comparePassword(body.password, user.password);
      if (!isMatch) {
        return { valid: false, message: "Invalid credentials." };
      }
      return { valid: true, message: "OK" };
    }

    case AUTH_STRATEGY.OTP: {
      // Scaffold for OTP validation — uncomment when ready:
      // const otpResult = await otpService.verifyOtp(user.phone, body.otp);
      // return otpResult;
      return { valid: false, message: "OTP login is not yet enabled." };
    }

    default:
      return { valid: false, message: "Unknown authentication strategy." };
  }
};

/**
 * Build JWT payload from a user document.
 */
const buildTokenPayload = (user) => ({
  userId: user._id.toString(),
  role: user.role,
  schoolId: user.schoolId.toString(),
  busId: user.busId ? user.busId.toString() : null
});

// ─────────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────────────────────────────────
const login = async (req, res) => {
  try {
    const { schoolCode, identifier, password, otp } = req.body;

    // ── Input validation ──────────────────────────────────────────────
    if (!schoolCode || !identifier) {
      return badRequest(res, "schoolCode and identifier are required.");
    }

    const trimmedSchoolCode = schoolCode.trim().toUpperCase();
    const trimmedIdentifier = identifier.trim();

    // ── Find school ───────────────────────────────────────────────────
    const school = await School.findOne({
      schoolCode: trimmedSchoolCode,
      isActive: true
    }).lean();

    if (!school) {
      return notFound(res, "School not found or is inactive.");
    }

    // ── Find user by phone OR rollNumber within the school ────────────
    const user = await User.findOne({
      schoolId: school._id,
      $or: [
        { phone: trimmedIdentifier },
        { rollNumber: trimmedIdentifier }
      ]
    });

    if (!user) {
      return unauthorized(res, "Invalid credentials.");
    }

    if (!user.isActive) {
      return unauthorized(res, "Account has been deactivated. Contact your school admin.");
    }

    // ── Resolve & validate auth strategy ──────────────────────────────
    const strategy = resolveStrategy({ password, otp });
    const result = await validateCredentials(strategy, user, { password, otp });

    if (!result.valid) {
      return unauthorized(res, result.message);
    }

    // ── Generate token ────────────────────────────────────────────────
    const payload = buildTokenPayload(user);
    const token = signToken(payload);

    return success(res, {
      token,
      user: {
        id: user._id,
        name: user.name,
        role: user.role,
        phone: user.phone,
        rollNumber: user.rollNumber,
        schoolId: user.schoolId?.toString?.() ?? user.schoolId,
        busId: user.busId ? user.busId.toString() : null,
        currentBusId: user.currentBusId ? user.currentBusId.toString() : null
      }
    }, "Login successful.");
  } catch (err) {
    console.error("Login error:", err);
    return badRequest(res, "Login failed. Please try again.");
  }
};

// ─────────────────────────────────────────────────────────────────────────
// GET /api/auth/me
// ─────────────────────────────────────────────────────────────────────────
const me = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId)
      .select("-password")
      .populate("schoolId", "name schoolCode")
      .lean();

    if (!user) {
      return notFound(res, "User not found.");
    }

    return success(res, user);
  } catch (err) {
    console.error("Me error:", err);
    return badRequest(res, "Could not fetch user profile.");
  }
};

module.exports = { login, me };
