import { useCallback, useEffect, useRef, useState } from 'react';
import { useGoogleMaps } from '../../hooks/useGoogleMaps';
import { ZONE_SHAPE, PENTAGON_VERTICES } from '../../constants/zoneShapes';
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  DEFAULT_ZONE_RADIUS_KM,
  MIN_ZONE_RADIUS_KM,
  MAX_ZONE_RADIUS_KM,
  GOOGLE_MAP_ID,
} from '../../constants/mapDefaults';
import {
  generateRegularPolygon,
  boundsFromPoints,
  parseCoord,
  hasValidCenter,
  polygonCentroid,
} from '../../utils/zoneMapGeometry';
import {
  createDraggableCenterMarker,
  createDraggableVertexMarker,
  detachMarker,
  readMarkerPosition,
} from '../../utils/googleMapMarkers';
import { triggerMapResize } from '../../utils/mapResize';
import MapSurface from './MapSurface';
import MapLocationSearch from './MapLocationSearch';

const SHAPE_STYLE = {
  fillColor: '#ffd86f',
  fillOpacity: 0.25,
  strokeColor: '#e6be5c',
  strokeWeight: 2,
};

const ZoneMapEditor = ({
  active = true,
  shapeType,
  lat,
  lng,
  radiusKm,
  polygonPoints = [],
  onChange,
}) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const pointsRef = useRef([]);
  const overlaysRef = useRef({ circle: null, polygon: null, centerMarker: null, vertexMarkers: [] });
  const onChangeRef = useRef(onChange);
  const [mapInstance, setMapInstance] = useState(null);
  const { maps, AdvancedMarkerElement, PinElement, ready, error } = useGoogleMaps();

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const emit = useCallback((patch) => {
    onChangeRef.current(patch);
  }, []);

  const getCenter = useCallback(() => {
    if (hasValidCenter(lat, lng)) {
      return { lat: parseCoord(lat), lng: parseCoord(lng) };
    }
    return { ...DEFAULT_MAP_CENTER };
  }, [lat, lng]);

  const getRadius = useCallback(
    () => parseCoord(radiusKm) || DEFAULT_ZONE_RADIUS_KM,
    [radiusKm],
  );

  const panToCenter = useCallback(
    (center, zoom = DEFAULT_MAP_ZOOM) => {
      const map = mapInstanceRef.current;
      if (!map) return;
      map.panTo(center);
      map.setZoom(zoom);
      triggerMapResize(map, maps);
    },
    [maps],
  );

  const clearOverlays = useCallback(() => {
    const o = overlaysRef.current;
    o.circle?.setMap(null);
    o.polygon?.setMap(null);
    detachMarker(o.centerMarker);
    o.vertexMarkers.forEach(detachMarker);
    overlaysRef.current = { circle: null, polygon: null, centerMarker: null, vertexMarkers: [] };
  }, []);

  const handlePlaceSelect = useCallback(
    ({ lat: placeLat, lng: placeLng, name }) => {
      const center = { lat: placeLat, lng: placeLng };
      const patch = {
        lat: String(placeLat),
        lng: String(placeLng),
      };
      if (name) patch.city = name;

      if (shapeType === ZONE_SHAPE.POLYGON) {
        patch.polygonPoints = generateRegularPolygon(center, getRadius(), PENTAGON_VERTICES, maps);
      }

      emit(patch);
      panToCenter(center, 14);
    },
    [emit, getRadius, maps, panToCenter, shapeType],
  );

  const rebuildPentagonFromCenter = useCallback(() => {
    const center = getCenter();
    const points = generateRegularPolygon(center, getRadius(), PENTAGON_VERTICES, maps);
    emit({
      polygonPoints: points,
      lat: String(center.lat),
      lng: String(center.lng),
    });
  }, [emit, getCenter, getRadius, maps]);

  const buildPentagonOverlays = useCallback(
    (map, points) => {
      const markerLib = { AdvancedMarkerElement, PinElement };
      pointsRef.current = points;

      const polygon = new maps.Polygon({ map, paths: points, ...SHAPE_STYLE });
      const vertexMarkers = points.map((pt, index) => {
        const marker = createDraggableVertexMarker({ ...markerLib, map, position: pt, index });
        marker.addListener('dragend', () => {
          const pos = readMarkerPosition(marker);
          if (!pos) return;
          const updated = pointsRef.current.map((p, i) => (i === index ? pos : p));
          pointsRef.current = updated;
          polygon.setPaths(updated);
          const centroid = polygonCentroid(updated);
          emit({
            polygonPoints: updated,
            lat: String(centroid.lat),
            lng: String(centroid.lng),
          });
        });
        return marker;
      });

      overlaysRef.current = { circle: null, polygon, centerMarker: null, vertexMarkers };
    },
    [AdvancedMarkerElement, PinElement, emit, maps],
  );

  const buildCircleOverlays = useCallback(
    (map, center) => {
      const markerLib = { AdvancedMarkerElement, PinElement };
      const radiusM = getRadius() * 1000;
      const centerMarker = createDraggableCenterMarker({ ...markerLib, map, position: center });
      const circle = new maps.Circle({ map, center, radius: radiusM, ...SHAPE_STYLE });

      centerMarker.addListener('dragend', () => {
        const next = readMarkerPosition(centerMarker);
        if (!next) return;
        circle.setCenter(next);
        emit({ lat: String(next.lat), lng: String(next.lng) });
      });

      overlaysRef.current = { circle, polygon: null, centerMarker, vertexMarkers: [] };
    },
    [AdvancedMarkerElement, PinElement, emit, getRadius, maps],
  );

  // Init map once
  useEffect(() => {
    if (!active || !ready || !maps || !mapRef.current) return undefined;

    let map = mapInstanceRef.current;
    if (!map) {
      map = new maps.Map(mapRef.current, {
        center: DEFAULT_MAP_CENTER,
        zoom: DEFAULT_MAP_ZOOM,
        mapId: GOOGLE_MAP_ID,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        restriction: {
          latLngBounds: { north: 35.5, south: 6.5, west: 68.1, east: 97.4 },
          strictBounds: false,
        },
      });

      map.addListener('click', (e) => {
        if (shapeType !== ZONE_SHAPE.CIRCLE) return;
        const o = overlaysRef.current;
        if (!o.centerMarker || !o.circle) return;
        const next = { lat: e.latLng.lat(), lng: e.latLng.lng() };
        o.centerMarker.position = next;
        o.circle.setCenter(next);
        emit({ lat: String(next.lat), lng: String(next.lng) });
      });

      mapInstanceRef.current = map;
      setMapInstance(map);
    }

    const resize = () => triggerMapResize(map, maps);
    requestAnimationFrame(resize);
    const observer = new ResizeObserver(resize);
    observer.observe(mapRef.current);
    return () => observer.disconnect();
  }, [active, ready, maps, emit, shapeType]);

  // Draw circle or pentagon overlays
  useEffect(() => {
    if (!active || !ready || !maps || !AdvancedMarkerElement || !PinElement || !mapInstanceRef.current) {
      return undefined;
    }

    const map = mapInstanceRef.current;
    clearOverlays();

    if (shapeType === ZONE_SHAPE.CIRCLE) {
      buildCircleOverlays(map, getCenter());
    } else {
      const points =
        polygonPoints?.length >= PENTAGON_VERTICES
          ? polygonPoints
          : generateRegularPolygon(getCenter(), getRadius(), PENTAGON_VERTICES, maps);

      if (polygonPoints?.length < PENTAGON_VERTICES) {
        const centroid = polygonCentroid(points);
        emit({
          polygonPoints: points,
          lat: String(centroid.lat),
          lng: String(centroid.lng),
        });
      }

      buildPentagonOverlays(map, points);

      const bounds = boundsFromPoints(points, maps);
      if (bounds) map.fitBounds(bounds, 48);
    }

    triggerMapResize(map, maps);
    return clearOverlays;
  }, [
    active,
    ready,
    maps,
    AdvancedMarkerElement,
    PinElement,
    shapeType,
    lat,
    lng,
    radiusKm,
    polygonPoints,
    clearOverlays,
    buildCircleOverlays,
    buildPentagonOverlays,
    getCenter,
    getRadius,
    emit,
  ]);

  useEffect(
    () => () => {
      clearOverlays();
      mapInstanceRef.current = null;
      setMapInstance(null);
    },
    [clearOverlays],
  );

  const isPolygon = shapeType === ZONE_SHAPE.POLYGON;
  const hint = isPolygon
    ? 'Drag corners 1–5 or adjust pentagon size below.'
    : 'Click the map or drag the pin to set center.';

  return (
    <div className="space-y-3">
      {ready && active && maps && (
        <MapLocationSearch
          maps={maps}
          map={mapInstance}
          enabled={ready}
          onSelect={handlePlaceSelect}
        />
      )}

      <MapSurface
        mapRef={mapRef}
        ready={ready && active}
        error={error}
        height={340}
        hint={ready && active && !error ? hint : undefined}
      />

      <div>
        <div className="flex items-center justify-between text-sm mb-1.5">
          <span className="font-medium text-slate-700">
            {isPolygon ? 'Pentagon size' : 'Service radius'}
          </span>
          <span className="font-mono text-slate-900">{getRadius()} km</span>
        </div>
        <input
          type="range"
          min={MIN_ZONE_RADIUS_KM}
          max={MAX_ZONE_RADIUS_KM}
          step="0.5"
          value={getRadius()}
          onChange={(e) => {
            const next = e.target.value;
            if (isPolygon) {
              const center = getCenter();
              const points = generateRegularPolygon(
                center,
                parseCoord(next) || DEFAULT_ZONE_RADIUS_KM,
                PENTAGON_VERTICES,
                maps,
              );
              emit({
                radiusKm: next,
                polygonPoints: points,
                lat: String(center.lat),
                lng: String(center.lng),
              });
            } else {
              emit({ radiusKm: next });
            }
          }}
          className="w-full accent-primary"
        />
        <div className="flex justify-between text-[10px] text-slate-400 mt-1">
          <span>{MIN_ZONE_RADIUS_KM} km</span>
          <span>{MAX_ZONE_RADIUS_KM} km</span>
        </div>
        {isPolygon && (
          <button
            type="button"
            onClick={rebuildPentagonFromCenter}
            className="mt-2 text-xs text-primary-dark font-medium hover:underline"
          >
            Reset pentagon around map center
          </button>
        )}
      </div>
    </div>
  );
};

export default ZoneMapEditor;
