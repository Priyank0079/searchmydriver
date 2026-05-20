/** Re-fit map tiles after container size changes (e.g. modal open). */
export function triggerMapResize(map, mapsApi) {
  if (!map || !mapsApi?.event) return;
  mapsApi.event.trigger(map, 'resize');
}
