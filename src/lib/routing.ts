export type RoutePoint = {
  latitude: number;
  longitude: number;
};

export type RouteResult = {
  distanceKm: number;
  durationMinutes: number;
  geometry: GeoJSON.GeoJSON;
};

const DEFAULT_ROUTING_API_URL = 'https://router.project-osrm.org';

function getRoutingApiUrl() {
  return (import.meta.env.VITE_ROUTING_API_URL || DEFAULT_ROUTING_API_URL).replace(/\/$/, '');
}

export async function fetchDrivingRoute(points: RoutePoint[], signal?: AbortSignal): Promise<RouteResult> {
  if (points.length < 2) throw new Error('At least two route points are required.');

  const coordinates = points
    .map((point) => `${point.longitude},${point.latitude}`)
    .join(';');

  const url = `${getRoutingApiUrl()}/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false`;
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Routing request failed with HTTP ${response.status}.`);

  const data = await response.json() as {
    code?: string;
    routes?: Array<{ distance?: number; duration?: number; geometry?: GeoJSON.GeoJSON }>;
  };

  const route = data.routes?.[0];
  if (data.code !== 'Ok' || !route?.geometry || typeof route.distance !== 'number' || typeof route.duration !== 'number') {
    throw new Error(data.code === 'NoRoute' ? 'No driving route found.' : 'No usable route returned.');
  }

  return {
    distanceKm: route.distance / 1000,
    durationMinutes: Math.max(1, Math.ceil(route.duration / 60)),
    geometry: route.geometry,
  };
}
