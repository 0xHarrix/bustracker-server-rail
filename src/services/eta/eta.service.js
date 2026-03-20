const Route = require("../../modules/routes/route.model");
const { getGoogleEta } = require("./mapsEta.provider");

const getTargetStopForUser = ({ route, userId }) => {
  if (!route || !Array.isArray(route.stops) || route.stops.length === 0) return null;
  const matched = route.stops.find((stop) => Array.isArray(stop.studentIds) && stop.studentIds.some((id) => id.toString() === userId));
  return matched || route.stops[0];
};

const computeEtaForBus = async ({ schoolId, busId, origin, userId = null }) => {
  const route = await Route.findOne({ schoolId, busId, isActive: true }).lean();
  if (!route) return null;

  const targetStop = userId ? getTargetStopForUser({ route, userId }) : route.stops[0];
  if (!targetStop) return null;

  const providerResult = await getGoogleEta({
    origin,
    destination: { lat: targetStop.lat, lng: targetStop.lng }
  });

  return {
    busId: busId.toString(),
    routeId: route._id.toString(),
    stopName: targetStop.name,
    stopSequence: targetStop.sequence,
    etaSeconds: providerResult.durationSeconds,
    etaMinutes: Math.ceil(providerResult.durationSeconds / 60),
    distanceMeters: providerResult.distanceMeters,
    computedAt: new Date().toISOString()
  };
};

module.exports = {
  computeEtaForBus
};
