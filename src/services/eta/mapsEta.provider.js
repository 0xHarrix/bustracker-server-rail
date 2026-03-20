const getGoogleEta = async ({ origin, destination }) => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_MAPS_API_KEY is not configured.");
  }

  const originStr = `${origin.lat},${origin.lng}`;
  const destinationStr = `${destination.lat},${destination.lng}`;
  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(originStr)}&destinations=${encodeURIComponent(destinationStr)}&departure_time=now&mode=driving&key=${apiKey}`;

  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google Distance Matrix request failed: ${response.status} ${text}`);
  }

  const payload = await response.json();
  const row = payload.rows && payload.rows[0];
  const element = row && row.elements && row.elements[0];

  if (!element || element.status !== "OK") {
    throw new Error("No valid ETA result returned by provider.");
  }

  return {
    distanceMeters: element.distance.value,
    durationSeconds: element.duration_in_traffic
      ? element.duration_in_traffic.value
      : element.duration.value
  };
};

module.exports = {
  getGoogleEta
};
