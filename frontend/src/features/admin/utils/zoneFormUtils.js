import { ZONE_SHAPE, PENTAGON_VERTICES } from '../../../constants/zoneShapes';
import { DEFAULT_MAP_CENTER, DEFAULT_ZONE_RADIUS_KM } from '../../../constants/mapDefaults';
import { hasValidCenter, parseCoord } from '../../../utils/zoneMapGeometry';

export const emptyZoneForm = () => ({
  name: '',
  code: '',
  description: '',
  city: '',
  shapeType: ZONE_SHAPE.CIRCLE,
  lat: String(DEFAULT_MAP_CENTER.lat),
  lng: String(DEFAULT_MAP_CENTER.lng),
  radiusKm: String(DEFAULT_ZONE_RADIUS_KM),
  polygonPoints: [],
  isActive: true,
  sortOrder: 0,
});

export function zoneToForm(zone) {
  return {
    name: zone.name || '',
    code: zone.code || '',
    description: zone.description || '',
    city: zone.city || '',
    shapeType: zone.shapeType || ZONE_SHAPE.CIRCLE,
    lat: zone.lat != null ? String(zone.lat) : '',
    lng: zone.lng != null ? String(zone.lng) : '',
    radiusKm:
      zone.radiusKm != null ? String(zone.radiusKm) : String(DEFAULT_ZONE_RADIUS_KM),
    polygonPoints: zone.polygonPoints || [],
    isActive: zone.isActive !== false,
    sortOrder: zone.sortOrder || 0,
  };
}

export function formToZonePayload(form) {
  const base = {
    name: form.name.trim(),
    code: form.code.trim() || undefined,
    description: form.description.trim(),
    city: form.city.trim(),
    shapeType: form.shapeType,
    isActive: form.isActive,
    sortOrder: Number(form.sortOrder) || 0,
  };

  if (form.shapeType === ZONE_SHAPE.POLYGON) {
    return {
      ...base,
      polygonPoints: form.polygonPoints,
      lat: parseCoord(form.lat),
      lng: parseCoord(form.lng),
    };
  }

  return {
    ...base,
    lat: Number(form.lat),
    lng: Number(form.lng),
    radiusKm: Number(form.radiusKm),
  };
}

export function validateZoneForm(form) {
  if (!form.name?.trim()) return 'Zone name is required';

  if (form.shapeType === ZONE_SHAPE.POLYGON) {
    if (!form.polygonPoints?.length || form.polygonPoints.length < PENTAGON_VERTICES) {
      return 'Draw a pentagon on the map (5 corners — drag pins or use the size slider)';
    }
    return null;
  }

  if (!hasValidCenter(form.lat, form.lng)) {
    return 'Pick a center point on the map';
  }
  const radius = Number(form.radiusKm);
  if (!Number.isFinite(radius) || radius < 0.5 || radius > 100) {
    return 'Radius must be between 0.5 and 100 km';
  }
  return null;
}
