import Zone from '../models/zone.model.js';
import { ApiError } from '../utils/apiError.js';
import { ZONE_SHAPE } from '../constants/zoneShapes.js';
import {
  slugifyZoneCode,
  parseCenterCoordinates,
  parseRadiusKm,
  centerToGeoPoint,
  boundaryFromPoints,
  centroidFromBoundary,
  parseShapeType,
  serializeZone,
} from '../utils/zone.util.js';

/** Fix legacy rows where circle zones stored boundary: { type: 'Polygon' } without coordinates */
async function repairInvalidZoneBoundaries() {
  await Zone.updateMany(
    {
      $or: [
        { shapeType: ZONE_SHAPE.CIRCLE, boundary: { $exists: true } },
        { boundary: { $exists: true }, 'boundary.coordinates': { $exists: false } },
        { boundary: { $exists: true }, 'boundary.coordinates': { $size: 0 } },
      ],
    },
    { $unset: { boundary: 1 } },
  );
}

function applyGeometry(payload, data) {
  const shapeType = parseShapeType(data.shapeType ?? payload.shapeType ?? ZONE_SHAPE.CIRCLE);
  payload.shapeType = shapeType;

  if (shapeType === ZONE_SHAPE.POLYGON) {
    const points = data.polygonPoints || data.boundary?.coordinates?.[0];
    if (!points?.length) {
      throw new ApiError(400, 'Draw a pentagon/polygon on the map');
    }
    payload.boundary = boundaryFromPoints(
      Array.isArray(points[0]) && typeof points[0][0] === 'number'
        ? points.map(([lng, lat]) => ({ lat, lng }))
        : points,
    );
    const centroid = centroidFromBoundary(payload.boundary);
    payload.center = centerToGeoPoint(centroid || parseCenterCoordinates(data));
    payload.radiusKm = null;
    delete payload.boundaryUnset;
    return;
  }

  const center = parseCenterCoordinates(data);
  payload.center = centerToGeoPoint(center);
  payload.radiusKm = parseRadiusKm(data.radiusKm, { required: true });
  payload.boundaryUnset = true;
  delete payload.boundary;
}

function buildZonePayload(data, { partial = false } = {}) {
  const payload = {};

  if (!partial || data.name !== undefined) {
    if (!data.name?.trim()) throw new ApiError(400, 'Zone name is required');
    payload.name = data.name.trim();
  }

  if (!partial || data.code !== undefined) {
    const code = slugifyZoneCode(data.code || data.name);
    if (!code) throw new ApiError(400, 'Zone code is required');
    payload.code = code;
  }

  if (data.description !== undefined) payload.description = (data.description || '').trim();
  if (data.city !== undefined) payload.city = (data.city || '').trim();
  if (data.isActive !== undefined) payload.isActive = Boolean(data.isActive);
  if (data.sortOrder !== undefined) payload.sortOrder = Number(data.sortOrder) || 0;

  const hasGeometry =
    data.shapeType !== undefined ||
    data.lat !== undefined ||
    data.lng !== undefined ||
    data.radiusKm !== undefined ||
    data.polygonPoints !== undefined;

  if (!partial || hasGeometry) {
    applyGeometry(payload, data);
  }

  return payload;
}

function toZoneDocument(payload, staffId) {
  const { boundaryUnset, ...doc } = payload;
  if (staffId) doc.createdBy = staffId;
  if (boundaryUnset) return doc;
  return doc;
}

export const createZoneService = async (staffId, data) => {
  const payload = buildZonePayload(data);

  const existing = await Zone.findOne({ code: payload.code });
  if (existing) {
    throw new ApiError(400, 'Zone code already exists. Use a unique code.');
  }

  const zone = await Zone.create(toZoneDocument(payload, staffId));

  if (payload.boundaryUnset) {
    await Zone.updateOne({ _id: zone._id }, { $unset: { boundary: 1 } });
    zone.boundary = undefined;
  }

  return serializeZone(zone);
};

export const listZonesService = async (query = {}) => {
  await repairInvalidZoneBoundaries();

  const filter = {};
  if (query.activeOnly === 'true' || query.activeOnly === true) {
    filter.isActive = true;
  }

  const zones = await Zone.find(filter).sort({ sortOrder: 1, name: 1 });
  return zones.map(serializeZone);
};

export const getZoneByIdService = async (id) => {
  const zone = await Zone.findById(id);
  if (!zone) throw new ApiError(404, 'Zone not found');
  return serializeZone(zone);
};

export const updateZoneService = async (id, data) => {
  const zone = await Zone.findById(id);
  if (!zone) throw new ApiError(404, 'Zone not found');

  const payload = buildZonePayload(data, { partial: true });

  if (payload.code && payload.code !== zone.code) {
    const taken = await Zone.findOne({ code: payload.code, _id: { $ne: id } });
    if (taken) throw new ApiError(400, 'Zone code already in use');
  }

  const { boundaryUnset, ...updates } = payload;
  Object.assign(zone, updates);

  if (boundaryUnset) {
    zone.set('boundary', undefined);
    await zone.save();
    await Zone.updateOne({ _id: zone._id }, { $unset: { boundary: 1 } });
  } else {
    await zone.save();
  }

  return serializeZone(await Zone.findById(id));
};

export const deleteZoneService = async (id) => {
  const zone = await Zone.findById(id);
  if (!zone) throw new ApiError(404, 'Zone not found');

  await Zone.deleteOne({ _id: zone._id });
  return { id: zone._id };
};

/**
 * Find the first *active* zone that contains a given point.
 *
 * Reusable by:
 *   - the user app, to gate booking creation by service-area coverage
 *   - the dispatcher, to cap radius expansion at the matching zone's radius
 *   - any future surface that needs to answer "do we operate here?"
 *
 * Polygon zones win over circle zones when both match the same point —
 * polygons are usually drawn more tightly and represent the truth, while
 * circles are convenient approximations.
 *
 * @param {{ lat:number; lng:number }} point
 * @returns {Promise<object|null>} the serialized zone, or null
 */
export const findActiveZoneForPointService = async ({ lat, lng } = {}) => {
  if (
    typeof lat !== 'number' ||
    typeof lng !== 'number' ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    throw new ApiError(400, 'Valid lat/lng are required');
  }

  // 1. Polygon match via $geoIntersects.
  const polygonHit = await Zone.findOne({
    isActive: true,
    shapeType: ZONE_SHAPE.POLYGON,
    boundary: {
      $geoIntersects: {
        $geometry: { type: 'Point', coordinates: [lng, lat] },
      },
    },
  });
  if (polygonHit) return serializeZone(polygonHit);

  // 2. Circle match via $geoNear (so we can compare to each zone's radiusKm).
  const circleHits = await Zone.aggregate([
    {
      $geoNear: {
        near: { type: 'Point', coordinates: [lng, lat] },
        distanceField: 'distanceMeters',
        spherical: true,
        key: 'center',
        query: { isActive: true, shapeType: ZONE_SHAPE.CIRCLE },
      },
    },
    {
      $match: {
        $expr: {
          $lte: ['$distanceMeters', { $multiply: ['$radiusKm', 1000] }],
        },
      },
    },
    { $sort: { distanceMeters: 1 } },
    { $limit: 1 },
  ]);

  if (circleHits[0]) {
    const hydrated = await Zone.findById(circleHits[0]._id);
    if (hydrated) return serializeZone(hydrated);
  }

  return null;
};

/**
 * List the IDs of every active zone (polygon OR circle) that contains
 * the given point. Unlike `findActiveZoneForPointService` this does NOT
 * stop at the first match — it returns every overlap so the caller can
 * fan out to all responsible parties.
 *
 * Used at booking creation time to stamp `booking.zoneIds`, which then
 * drives the admin emergency-pool list (a team_member sees a booking
 * iff at least one of its `zoneIds` is in their `assignedZones`).
 *
 * Best-effort: bad coords return [], never throw.
 *
 * @param {{ lat:number; lng:number }} point
 * @returns {Promise<string[]>} ObjectId strings of every matching zone
 */
export const findActiveZoneIdsForPointService = async ({ lat, lng } = {}) => {
  if (
    typeof lat !== 'number' ||
    typeof lng !== 'number' ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return [];
  }

  const [polygonHits, circleHits] = await Promise.all([
    Zone.find({
      isActive: true,
      shapeType: ZONE_SHAPE.POLYGON,
      boundary: {
        $geoIntersects: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
        },
      },
    }).select('_id'),
    Zone.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [lng, lat] },
          distanceField: 'distanceMeters',
          spherical: true,
          key: 'center',
          query: { isActive: true, shapeType: ZONE_SHAPE.CIRCLE },
        },
      },
      {
        $match: {
          $expr: {
            $lte: ['$distanceMeters', { $multiply: ['$radiusKm', 1000] }],
          },
        },
      },
      { $project: { _id: 1 } },
    ]),
  ]);

  const ids = new Set();
  for (const hit of polygonHits) ids.add(String(hit._id));
  for (const hit of circleHits) ids.add(String(hit._id));
  return [...ids];
};
