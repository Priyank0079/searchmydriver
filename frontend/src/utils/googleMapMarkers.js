/** @param {google.maps.marker.AdvancedMarkerElement} marker */
export function readMarkerPosition(marker) {
  const p = marker?.position;
  if (!p) return null;
  const lat = typeof p.lat === 'function' ? p.lat() : p.lat;
  const lng = typeof p.lng === 'function' ? p.lng() : p.lng;
  return { lat, lng };
}

export function detachMarker(marker) {
  if (marker) marker.map = null;
}

export function createDraggableCenterMarker({ AdvancedMarkerElement, PinElement, map, position }) {
  const pin = new PinElement({
    background: '#ffd86f',
    borderColor: '#e6be5c',
    glyphColor: '#1e293b',
  });
  return new AdvancedMarkerElement({
    map,
    position,
    gmpDraggable: true,
    title: 'Drag to move zone center',
    content: pin,
  });
}

export function createDraggableVertexMarker({
  AdvancedMarkerElement,
  PinElement,
  map,
  position,
  index,
}) {
  const pin = new PinElement({
    glyph: String(index + 1),
    background: '#ffffff',
    borderColor: '#e6be5c',
    glyphColor: '#334155',
  });
  return new AdvancedMarkerElement({
    map,
    position,
    gmpDraggable: true,
    title: `Corner ${index + 1}`,
    content: pin,
  });
}
