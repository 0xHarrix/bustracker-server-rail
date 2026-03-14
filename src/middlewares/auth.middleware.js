const { verifyToken } = require("../utils/jwt");
const { unauthorized } = require("../utils/response");
const User = require("../modules/users/user.model");

/**
 * Authenticate requests via Bearer token.
 *
 * - Extracts the JWT from the Authorization header
 * - Verifies the token
 * - Loads the user and confirms they are still active
 * - Attaches user payload to req.user
 */
const authenticate = async (req, res, next) => {
  try {
    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
      return unauthorized(res, "Authentication required. Please provide a valid token.");
    }

    const token = header.split(" ")[1];

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return unauthorized(res, "Token has expired. Please login again.");
      }
      return unauthorized(res, "Invalid token.");
    }

    // Verify user still exists and is active
    const user = await User.findById(decoded.userId).select("-password").lean();

    if (!user) {
      return unauthorized(res, "User no longer exists.");
    }

    if (!user.isActive) {
      return unauthorized(res, "Account has been deactivated. Contact your school admin.");
    }

    // Attach full user context for downstream use (Model A: busId = route, currentBusId = boarded)
    req.user = {
      userId: user._id.toString(),
      role: user.role,
      schoolId: user.schoolId.toString(),
      busId: user.busId ? user.busId.toString() : null,
      currentBusId: user.currentBusId ? user.currentBusId.toString() : null
    };

    next();
  } catch (err) {
    return unauthorized(res, "Authentication failed.");
  }
};

module.exports = { authenticate };
