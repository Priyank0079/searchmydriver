/**
 * Shared map look-and-feel for every consumer-facing screen.
 *
 *   1. `PIN_ASSETS`         — paths to the in-app pin images.
 *   2. `RAPIDO_MAP_STYLES`  — a Rapido-style colour palette for the basemap.
 *                             Applied to maps without a vector mapId or to
 *                             raster mapIds. (Vector-mapId maps must be
 *                             styled in Google Cloud Console — see the
 *                             `VITE_GOOGLE_MAP_ID` env to point at a custom
 *                             cloud style.)
 *   3. `RAPIDO_MAP_OPTIONS` — common `google.maps.Map` options consumer
 *                             screens should spread on construction.
 *   4. `createImageMarkerContent` — builds the HTML element used as
 *                             `AdvancedMarkerElement.content` so any image
 *                             from `PIN_ASSETS` can sit on a map.
 *
 * Use this from `NearbyDriversMap`, `HourlyTripDetailsPage`,
 * `SelectPickupPage`, and any future consumer map. Admin tools keep their
 * data-dense default Google styling intact.
 */

export const PIN_ASSETS = Object.freeze({
  /** Where the user themself is right now. Green pin with a person. */
  CURRENT_LOCATION: '/images/pin/location.png',
  /** Each nearby/online driver. Coral pin with a person silhouette. */
  DRIVER: '/images/pin/user.png',
  /** The pickup location for a booking. Coral pin with a car. */
  PICKUP: '/images/pin/gps.png',
});

/**
 * Rapido-inspired soft palette. Cream landscape, white roads with subtle
 * outlines, warm-amber highways, all POI/transit labels stripped. Designed
 * to push driver/pickup pins into the foreground.
 *
 * NB: When a *vector* mapId is in use, Google ignores `styles`. The visual
 * result will still match because the AdvancedMarkers + clean UI options
 * already do most of the work — but switching the project to a Cloud-styled
 * Map ID is the proper long-term solution.
 */
export const RAPIDO_MAP_STYLES = Object.freeze([
  { elementType: 'geometry', stylers: [{ color: '#f4efe6' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6b6157' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#fdfbf6' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.neighborhood', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#e3eedb' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#e6dfd4' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#fff9ec' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#ffdfa7' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#e8b974' }] },
  { featureType: 'road.highway.controlled_access', elementType: 'geometry', stylers: [{ color: '#ffd07a' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#cfe2eb' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4a7793' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#ebe6dc' }] },
]);

/** Defaults every consumer map should start with. */
export const RAPIDO_MAP_OPTIONS = Object.freeze({
  disableDefaultUI: true,
  clickableIcons: false,
  gestureHandling: 'greedy',
  backgroundColor: '#f4efe6',
  styles: RAPIDO_MAP_STYLES,
});

/**
 * Builds an HTMLElement to feed into `AdvancedMarkerElement.content`. The
 * marker's anchor is the bottom-centre of the element (Google default), so
 * the pin's tip will sit on the requested coordinate.
 *
 * @param {string} src              Public path of the pin image.
 * @param {object} [opts]
 * @param {number} [opts.size=48]   Pin width in CSS pixels.
 * @param {string} [opts.alt='Pin'] Image alt text.
 * @param {boolean} [opts.bounce]   Adds a gentle entry bounce — use sparingly.
 * @returns {HTMLDivElement}
 */
export function createImageMarkerContent(src, { size = 48, alt = 'Pin', bounce = false } = {}) {
  const wrapper = document.createElement('div');
  wrapper.className = 'gmap-image-pin';
  // The image's "tip" sits a little above the very bottom of the canvas;
  // a small negative margin keeps the visible tip on the coordinate.
  wrapper.style.cssText = [
    `width:${size}px`,
    `height:${Math.round(size * 1.25)}px`,
    'display:flex',
    'align-items:flex-end',
    'justify-content:center',
    'margin-bottom:-4px',
    'pointer-events:auto',
    bounce ? 'animation:gmap-pin-bounce 280ms ease-out;' : '',
  ].join(';');

  const img = document.createElement('img');
  img.src = src;
  img.alt = alt;
  img.draggable = false;
  img.style.cssText = [
    'width:100%',
    'height:100%',
    'object-fit:contain',
    'filter:drop-shadow(0 4px 6px rgba(15, 23, 42, 0.22))',
    'transition:transform 140ms ease-out',
  ].join(';');
  wrapper.appendChild(img);
  return wrapper;
}
