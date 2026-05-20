import { PENTAGON_VERTICES } from '../constants/zoneShapes';
import { DEFAULT_MAP_CENTER, DEFAULT_ZONE_RADIUS_KM } from '../constants/mapDefaults';

export function parseCoord(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function hasValidCenter(lat, lng) {
  const la = parseCoord(lat);
  const lo = parseCoord(lng);
  return la != null && lo != null && la >= -90 && la <= 90 && lo >= -180 && lo <= 180;
}

export function centerFromForm(form) {
  if (hasValidCenter(form.lat, form.lng)) {
    return { lat: parseCoord(form.lat), lng: parseCoord(form.lng) };
  }
  return { ...DEFAULT_MAP_CENTER };
}

/**
 * Regular polygon around center (km). Uses spherical offset when google.maps is available.
 */
export function generateRegularPolygon(center, radiusKm, sides = PENTAGON_VERTICES, mapsApi) {
  const spherical = mapsApi?.geometry?.spherical;
  if (spherical?.computeOffset) {
    const origin = new mapsApi.LatLng(center.lat, center.lng);
    const points = [];
    for (let i = 0; i < sides; i += 1) {
      const heading = (360 / sides) * i - 90;
      const vertex = spherical.computeOffset(origin, radiusKm * 1000, heading);
      points.push({ lat: vertex.lat(), lng: vertex.lng() });
    }
    return points;
  }

  const latRad = (center.lat * Math.PI) / 180;
  const kmPerDegLat = 111.32;
  const kmPerDegLng = 111.32 * Math.cos(latRad);
  const points = [];
  for (let i = 0; i < sides; i += 1) {
    const angle = ((2 * Math.PI) / sides) * i - Math.PI / 2;
    points.push({
      lat: center.lat + (radiusKm / kmPerDegLat) * Math.cos(angle),
      lng: center.lng + (radiusKm / kmPerDegLng) * Math.sin(angle),
    });
  }
  return points;
}

export function polygonCentroid(points = []) {
  if (!points.length) return null;
  let sumLat = 0;
  let sumLng = 0;
  points.forEach((p) => {
    sumLat += p.lat;
    sumLng += p.lng;
  });
  return { lat: sumLat / points.length, lng: sumLng / points.length };
}

export function ensurePolygonPoints(form, mapsApi) {
  if (form.polygonPoints?.length >= 3) return form.polygonPoints;
  const center = centerFromForm(form);
  const radiusKm = parseCoord(form.radiusKm) || DEFAULT_ZONE_RADIUS_KM;
  return generateRegularPolygon(center, radiusKm, PENTAGON_VERTICES, mapsApi);
}

export function boundsFromPoints(points, mapsApi) {
  if (!points?.length || !mapsApi?.LatLngBounds) return null;
  const bounds = new mapsApi.LatLngBounds();
  points.forEach((p) => bounds.extend(new mapsApi.LatLng(p.lat, p.lng)));
  return bounds;
}
