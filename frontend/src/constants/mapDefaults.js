/** India — New Delhi (default zone center for admin zones) */
export const DEFAULT_MAP_CENTER = { lat: 28.6139, lng: 77.209 };
export const DEFAULT_MAP_ZOOM = 12;
export const INDIA_MAP_BOUNDS = { north: 35.5, south: 6.5, west: 68.1, east: 97.4 };
export const PLACES_COUNTRY = 'in';

export const DEFAULT_ZONE_RADIUS_KM = 5;
export const MIN_ZONE_RADIUS_KM = 0.5;
export const MAX_ZONE_RADIUS_KM = 100;

export const GOOGLE_MAP_ID =
  import.meta.env.VITE_GOOGLE_MAP_ID?.trim() || 'DEMO_MAP_ID';
