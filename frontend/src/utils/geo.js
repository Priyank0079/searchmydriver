/**
 * Small set of geo helpers used by the map / nearby-driver layer.
 * Everything here is pure and framework-agnostic.
 */

const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * Great-circle distance between two lat/lng points (haversine formula).
 *
 * @param {{ lat:number, lng:number }} a
 * @param {{ lat:number, lng:number }} b
 * @returns {number} distance in metres, or `NaN` if either point is invalid
 */
export function haversineMeters(a, b) {
  if (!a || !b) return NaN;
  if (
    typeof a.lat !== 'number' ||
    typeof a.lng !== 'number' ||
    typeof b.lat !== 'number' ||
    typeof b.lng !== 'number'
  ) {
    return NaN;
  }
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Human-friendly distance label: "320 m" / "1.2 km" / "—".
 */
export function formatDistance(meters) {
  if (!Number.isFinite(meters)) return '—';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(meters < 10_000 ? 1 : 0)} km`;
}

/**
 * Estimate ETA from straight-line distance assuming an average urban speed
 * of 25 km/h. Good enough for nearby-driver chips; routing-based ETAs come
 * from Google Directions later.
 */
export function estimateEtaMinutes(meters, avgKmh = 25) {
  if (!Number.isFinite(meters) || meters <= 0) return null;
  const hours = meters / 1000 / avgKmh;
  return Math.max(1, Math.round(hours * 60));
}
