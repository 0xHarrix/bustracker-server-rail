const { forbidden } = require("../utils/response");

/**
 * Restrict access to specific roles.
 *
 * @param  {...string} allowedRoles - Roles permitted to access the route
 * @returns {Function} Express middleware
 *
 * @example
 * router.post("/schools", authenticate, authorize("admin"), createSchool);
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return forbidden(res, "Authentication required before authorization.");
    }

    if (!allowedRoles.includes(req.user.role)) {
      return forbidden(
        res,
        `Access denied. Required role(s): ${allowedRoles.join(", ")}.`
      );
    }

    next();
  };
};

module.exports = { authorize };
