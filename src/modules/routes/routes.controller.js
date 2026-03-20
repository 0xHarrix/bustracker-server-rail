const mongoose = require("mongoose");
const Bus = require("../buses/bus.model");
const Route = require("./route.model");
const { success, created, badRequest, notFound, conflict } = require("../../utils/response");

const normalizeStops = (stops) => {
  if (!Array.isArray(stops)) return [];
  return stops
    .filter((stop) => stop && stop.name)
    .map((stop, index) => ({
      name: String(stop.name).trim(),
      sequence: Number(stop.sequence) || index + 1,
      lat: Number(stop.lat),
      lng: Number(stop.lng),
      radiusMeters: stop.radiusMeters ? Number(stop.radiusMeters) : 100,
      plannedPickupTime: stop.plannedPickupTime || null,
      plannedDropTime: stop.plannedDropTime || null,
      studentIds: Array.isArray(stop.studentIds)
        ? stop.studentIds.filter((id) => mongoose.Types.ObjectId.isValid(id))
        : []
    }))
    .sort((a, b) => a.sequence - b.sequence);
};

const createRoute = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { busId, name, stops } = req.body;

    if (!mongoose.Types.ObjectId.isValid(busId)) {
      return badRequest(res, "Valid busId is required.");
    }
    if (!name) {
      return badRequest(res, "name is required.");
    }

    const bus = await Bus.findOne({ _id: busId, schoolId, isActive: true }).lean();
    if (!bus) return notFound(res, "Bus not found in your school.");

    const existing = await Route.findOne({ schoolId, busId }).lean();
    if (existing) return conflict(res, "Route already exists for this bus.");

    const route = await Route.create({
      schoolId,
      busId,
      name: String(name).trim(),
      stops: normalizeStops(stops)
    });

    return created(res, route, "Route created successfully.");
  } catch (err) {
    console.error("Create route error:", err);
    if (err.code === 11000) return conflict(res, "Route already exists for this bus.");
    return badRequest(res, "Failed to create route.");
  }
};

const listRoutes = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const routes = await Route.find({ schoolId })
      .populate("busId", "busNumber")
      .sort({ createdAt: -1 })
      .lean();
    return success(res, routes);
  } catch (err) {
    console.error("List routes error:", err);
    return badRequest(res, "Failed to fetch routes.");
  }
};

const getRouteById = async (req, res) => {
  try {
    const { id } = req.params;
    const { schoolId } = req.user;
    if (!mongoose.Types.ObjectId.isValid(id)) return badRequest(res, "Invalid route ID.");

    const route = await Route.findOne({ _id: id, schoolId }).populate("busId", "busNumber").lean();
    if (!route) return notFound(res, "Route not found.");
    return success(res, route);
  } catch (err) {
    console.error("Get route error:", err);
    return badRequest(res, "Failed to fetch route.");
  }
};

const updateRoute = async (req, res) => {
  try {
    const { id } = req.params;
    const { schoolId } = req.user;
    if (!mongoose.Types.ObjectId.isValid(id)) return badRequest(res, "Invalid route ID.");

    const payload = {};
    if (req.body.name) payload.name = String(req.body.name).trim();
    if (req.body.stops) payload.stops = normalizeStops(req.body.stops);
    if (req.body.isActive !== undefined) payload.isActive = Boolean(req.body.isActive);

    const route = await Route.findOneAndUpdate({ _id: id, schoolId }, { $set: payload }, { new: true });
    if (!route) return notFound(res, "Route not found.");
    return success(res, route, "Route updated successfully.");
  } catch (err) {
    console.error("Update route error:", err);
    return badRequest(res, "Failed to update route.");
  }
};

const deleteRoute = async (req, res) => {
  try {
    const { id } = req.params;
    const { schoolId } = req.user;
    if (!mongoose.Types.ObjectId.isValid(id)) return badRequest(res, "Invalid route ID.");

    const route = await Route.findOneAndDelete({ _id: id, schoolId }).lean();
    if (!route) return notFound(res, "Route not found.");
    return success(res, null, "Route deleted successfully.");
  } catch (err) {
    console.error("Delete route error:", err);
    return badRequest(res, "Failed to delete route.");
  }
};

const getCurrentRoute = async (req, res) => {
  try {
    const { schoolId, busId } = req.user;
    if (!busId) return notFound(res, "No bus assigned for current user.");
    const route = await Route.findOne({ schoolId, busId, isActive: true })
      .populate("busId", "busNumber")
      .lean();
    if (!route) return notFound(res, "No active route found for current bus.");
    return success(res, route);
  } catch (err) {
    console.error("Get current route error:", err);
    return badRequest(res, "Failed to fetch current route.");
  }
};

module.exports = {
  createRoute,
  listRoutes,
  getRouteById,
  updateRoute,
  deleteRoute,
  getCurrentRoute
};
