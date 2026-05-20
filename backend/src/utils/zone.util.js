import { ApiError } from './apiError.js';
import { ZONE_SHAPE } from '../constants/zoneShapes.js';

const MIN_RADIUS_KM = 0.5;
const MAX_RADIUS_KM = 100;
const MIN_POLYGON_VERTICES = 3;
const MAX_POLYGON_VERTICES = 12;

export function slugifyZoneCode(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function parseCenterCoordinates(input = {}) {
  const lat = Number(input.lat ?? input.latitude);
  const lng = Number(input.lng ?? input.longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new ApiError(400, 'Valid center latitude and longitude are required');
  }
  if (lat < -90 || lat > 90) {
    throw new ApiError(400, 'Latitude must be between -90 and 90');
  }
  if (lng < -180 || lng > 180) {
    throw new ApiError(400, 'Longitude must be between -180 and 180');
  }

  return { lat, lng };
}

export function parseRadiusKm(value, { required = true } = {}) {
  if (value === undefined || value === null || value === '') {
    if (!required) return null;
    throw new ApiError(400, 'Service radius (km) is required');
  }

  const radiusKm = Number(value);
  if (!Number.isFinite(radiusKm)) {
    throw new ApiError(400, 'Service radius (km) is required');
  }
  if (radiusKm < MIN_RADIUS_KM || radiusKm > MAX_RADIUS_KM) {
    throw new ApiError(
      400,
      `Service radius must be between ${MIN_RADIUS_KM} and ${MAX_RADIUS_KM} km`,
    );
  }
  return radiusKm;
}

export function centerToGeoPoint({ lat, lng }) {
  return {
    type: 'Point',
    coordinates: [lng, lat],
  };
}

export function geoPointToCenter(point) {
  if (!point?.coordinates?.length) return { lat: null, lng: null };
  const [lng, lat] = point.coordinates;
  return { lat, lng };
}

function closeRing(coords) {
  if (!coords.length) return coords;
  const first = coords[0];
  const last = coords[coords.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) return coords;
  return [...coords, first];
}

/**
 * @param {Array<{ lat: number, lng: number }>|Array<[number, number]>} points
 */
export function boundaryFromPoints(points = []) {
  if (!Array.isArray(points) || points.length < MIN_POLYGON_VERTICES) {
    throw new ApiError(400, `Polygon must have at least ${MIN_POLYGON_VERTICES} points`);
  }
  if (points.length > MAX_POLYGON_VERTICES) {
    throw new ApiError(400, `Polygon cannot have more than ${MAX_POLYGON_VERTICES} points`);
  }

  const ring = points.map((p) => {
    const lat = Number(p.lat ?? p[1]);
    const lng = Number(p.lng ?? p[0]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new ApiError(400, 'Invalid polygon coordinates');
    }
    return [lng, lat];
  });

  return {
    type: 'Polygon',
    coordinates: [closeRing(ring)],
  };
}

export function pointsFromBoundary(boundary) {
  const ring = boundary?.coordinates?.[0];
  if (!ring?.length) return [];

  const open = ring.length > 1 &&
    ring[0][0] === ring[ring.length - 1][0] &&
    ring[0][1] === ring[ring.length - 1][1]
    ? ring.slice(0, -1)
    : ring;

  return open.map(([lng, lat]) => ({ lat, lng }));
}

export function centroidFromBoundary(boundary) {
  const points = pointsFromBoundary(boundary);
  if (!points.length) return null;

  let sumLat = 0;
  let sumLng = 0;
  points.forEach((p) => {
    sumLat += p.lat;
    sumLng += p.lng;
  });
  return { lat: sumLat / points.length, lng: sumLng / points.length };
}

export function parseShapeType(value) {
  const shapeType = value === ZONE_SHAPE.POLYGON ? ZONE_SHAPE.POLYGON : ZONE_SHAPE.CIRCLE;
  return shapeType;
}

export function serializeZone(doc) {
  const o = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  const center = geoPointToCenter(o.center);
  const polygonPoints = pointsFromBoundary(o.boundary);

  return {
    ...o,
    shapeType: o.shapeType || ZONE_SHAPE.CIRCLE,
    lat: center.lat,
    lng: center.lng,
    polygonPoints,
  };
}
