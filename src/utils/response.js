/**
 * Standardized API response helpers.
 */

const success = (res, data = null, message = "Success", statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
};

const created = (res, data = null, message = "Created successfully") => {
  return success(res, data, message, 201);
};

const error = (res, message = "Something went wrong", statusCode = 500, errors = null) => {
  const body = {
    success: false,
    message
  };
  if (errors) body.errors = errors;
  return res.status(statusCode).json(body);
};

const badRequest = (res, message = "Bad request", errors = null) => {
  return error(res, message, 400, errors);
};

const unauthorized = (res, message = "Unauthorized") => {
  return error(res, message, 401);
};

const forbidden = (res, message = "Forbidden") => {
  return error(res, message, 403);
};

const notFound = (res, message = "Not found") => {
  return error(res, message, 404);
};

const conflict = (res, message = "Conflict") => {
  return error(res, message, 409);
};

module.exports = {
  success,
  created,
  error,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict
};
