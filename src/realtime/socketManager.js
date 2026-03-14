/**
 * Singleton module to share Socket.IO instance and in-memory
 * active trip cache across the application.
 *
 * Usage:
 *   const socketManager = require("./socketManager");
 *   socketManager.setIO(io);          // once during init
 *   socketManager.getIO();            // anywhere
 *   socketManager.activeTrips;        // in-memory cache
 */

let _io = null;

// ── In-memory active trip cache ──────────────────────────────────────────
// Key: busId (string) → Value: tripId (string)
// Avoids DB lookup on every GPS update.
// Must be kept in sync with trip start/end events.
const activeTrips = {};

// ── In-memory last known location per bus ────────────────────────────────
// Key: busId (string) → Value: { lat, lng, speed, timestamp, tripId, busId }
// Updated on every valid GPS emit from driver.
// Used by admin to see all live bus positions.
const lastLocations = {};

const setIO = (io) => {
  _io = io;
};

const getIO = () => {
  return _io;
};

/**
 * Register a trip as active in the cache.
 * @param {string} busId
 * @param {string} tripId
 */
const addActiveTrip = (busId, tripId) => {
  activeTrips[busId] = tripId;
};

/**
 * Remove a trip from the active cache and clear its last location.
 * @param {string} busId
 */
const removeActiveTrip = (busId) => {
  delete activeTrips[busId];
  delete lastLocations[busId];
};

/**
 * Check if a bus has an active trip in cache.
 * @param {string} busId
 * @returns {string|null} tripId or null
 */
const getActiveTrip = (busId) => {
  return activeTrips[busId] || null;
};

/**
 * Store the latest location for a bus.
 * @param {string} busId
 * @param {object} location - { lat, lng, speed, timestamp, tripId, busId }
 */
const setLastLocation = (busId, location) => {
  lastLocations[busId] = location;
};

/**
 * Get last known location for a bus.
 * @param {string} busId
 * @returns {object|null}
 */
const getLastLocation = (busId) => {
  return lastLocations[busId] || null;
};

/**
 * Get all last known locations for a school.
 * @param {string} schoolId
 * @returns {object[]} Array of location objects
 */
const getAllLocationsForSchool = (schoolId) => {
  // activeTrips is keyed by busId; we need to filter by schoolId.
  // Since locations store schoolId, we can filter directly.
  return Object.values(lastLocations).filter(
    (loc) => loc.schoolId === schoolId
  );
};

module.exports = {
  setIO,
  getIO,
  activeTrips,
  addActiveTrip,
  removeActiveTrip,
  getActiveTrip,
  lastLocations,
  setLastLocation,
  getLastLocation,
  getAllLocationsForSchool
};
