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
