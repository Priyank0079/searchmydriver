import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import { useGoogleMaps } from '../../hooks/useGoogleMaps';
import { useDirectionsRoute } from '../../hooks/useDirectionsRoute';
import { GOOGLE_MAP_ID } from '../../constants/mapDefaults';
import {
  PIN_ASSETS,
  RAPIDO_MAP_OPTIONS,
  createImageMarkerContent,
} from '../../constants/mapTheme';
import { formatDistance, estimateEtaMinutes, haversineMeters } from '../../utils/geo';

const ROUTE_COLOR = '#1F8A4C';
const ROUTE_OUTLINE_COLOR = '#0F5F33';

/**
 * Map for the post-acceptance phase of a booking — shows the driver pin,
 * the pickup pin and (optionally) a polyline plus ETA label between them.
 * Reused by both the user-side `DriverAssignedPage` and the driver-side
 * `DriverActiveTripPage`, where the audience differs but the visual logic
 * is identical.
 *
 *   props:
 *     - driver         { lat, lng, heading? } — the driver's live location.
 *     - pickup         { lat, lng } — the customer's pickup.
 *     - dropoff        Optional { lat, lng } — drawn as an extra pin when
 *                      the booking has a separate drop location (outstation).
 *     - height         CSS height. Default `260px`.
 *     - showRoute      When true, draws a road-following route between the
 *                      driver and the pickup (via Google DirectionsService)
 *                      plus an ETA badge. While the route is being fetched
 *                      we draw a dotted approximate line so the screen isn't
 *                      empty.
 *     - emphasis       'driver' | 'pickup' — which pin is rendered larger.
 *                      Drivers see the pickup emphasised; customers see the
 *                      driver emphasised.
 *     - className      Extra wrapper classes.
 *     - onEtaChange    Optional callback invoked with `{ distanceMeters,
 *                      etaMinutes }` whenever either input moves.
 */
const TripTrackingMap = ({
  driver,
  pickup,
  dropoff = null,
  height = 260,
  showRoute = true,
  emphasis = 'driver',
  className = '',
  onEtaChange,
}) => {
  const { maps, AdvancedMarkerElement, ready, error } = useGoogleMaps();
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [mapInstance, setMapInstance] = useState(null);

  const driverMarkerRef = useRef(null);
  const pickupMarkerRef = useRef(null);
  const dropMarkerRef = useRef(null);
  // Two polylines layered together produce the "stroked" Rapido look:
  // a darker thicker outline behind a brighter narrower stroke on top.
  const routeOutlineRef = useRef(null);
  const routeStrokeRef = useRef(null);
  // The dashed fallback line we draw when the Directions API hasn't
  // responded yet (or has failed). Kept on its own ref so we can swap it
  // in/out independently of the road-following route.
  const fallbackLineRef = useRef(null);
  const fittedKeyRef = useRef(null);

  /* ---- Init the map once both endpoints are known --------------------- */
  useEffect(() => {
    if (!ready || !maps || !containerRef.current || mapRef.current) return;
    const initialCenter = pickup || driver || { lat: 0, lng: 0 };
    mapRef.current = new maps.Map(containerRef.current, {
      ...RAPIDO_MAP_OPTIONS,
      center: initialCenter,
      zoom: 14,
      mapId: GOOGLE_MAP_ID,
    });
    setMapInstance(mapRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, maps]);

  /* ---- Pickup marker -------------------------------------------------- */
  useEffect(() => {
    if (!mapInstance || !AdvancedMarkerElement || !pickup) return undefined;
    const size = emphasis === 'pickup' ? 52 : 44;
    if (!pickupMarkerRef.current) {
      pickupMarkerRef.current = new AdvancedMarkerElement({
        map: mapInstance,
        position: pickup,
        content: createImageMarkerContent(PIN_ASSETS.PICKUP, { size, alt: 'Pickup' }),
        title: 'Pickup',
        zIndex: 4,
      });
    } else {
      pickupMarkerRef.current.position = pickup;
      pickupMarkerRef.current.content = createImageMarkerContent(PIN_ASSETS.PICKUP, {
        size,
        alt: 'Pickup',
      });
    }
    return undefined;
  }, [mapInstance, AdvancedMarkerElement, pickup, emphasis]);

  /* ---- Driver marker -------------------------------------------------- */
  useEffect(() => {
    if (!mapInstance || !AdvancedMarkerElement) return undefined;
    if (!driver) {
      if (driverMarkerRef.current) {
        driverMarkerRef.current.map = null;
        driverMarkerRef.current = null;
      }
      return undefined;
    }
    const size = emphasis === 'driver' ? 52 : 44;
    if (!driverMarkerRef.current) {
      driverMarkerRef.current = new AdvancedMarkerElement({
        map: mapInstance,
        position: driver,
        content: createImageMarkerContent(PIN_ASSETS.DRIVER, { size, alt: 'Driver' }),
        title: 'Driver',
        zIndex: 6,
      });
    } else {
      driverMarkerRef.current.position = driver;
    }
    return undefined;
  }, [mapInstance, AdvancedMarkerElement, driver, emphasis]);

  /* ---- Optional drop-off marker --------------------------------------- */
  useEffect(() => {
    if (!mapInstance || !AdvancedMarkerElement) return undefined;
    if (!dropoff) {
      if (dropMarkerRef.current) {
        dropMarkerRef.current.map = null;
        dropMarkerRef.current = null;
      }
      return undefined;
    }
    if (!dropMarkerRef.current) {
      dropMarkerRef.current = new AdvancedMarkerElement({
        map: mapInstance,
        position: dropoff,
        content: createImageMarkerContent(PIN_ASSETS.PICKUP, { size: 40, alt: 'Drop' }),
        title: 'Drop',
        zIndex: 3,
      });
    } else {
      dropMarkerRef.current.position = dropoff;
    }
    return undefined;
  }, [mapInstance, AdvancedMarkerElement, dropoff]);

  /* ---- Directions API: road-following route -------------------------- */
  const {
    path: routePath,
    distanceMeters: routeDistanceMeters,
    durationSeconds: routeDurationSeconds,
  } = useDirectionsRoute({
    maps,
    origin: showRoute ? driver : null,
    destination: showRoute ? pickup : null,
    enabled: showRoute && Boolean(driver && pickup),
  });

  /* ---- Render the real route polyline (outline + stroke) ------------- */
  useEffect(() => {
    if (!mapInstance || !maps) return undefined;
    const hasRoute = showRoute && routePath && routePath.length > 1;
    if (!hasRoute) {
      [routeOutlineRef, routeStrokeRef].forEach((ref) => {
        if (ref.current) {
          ref.current.setMap(null);
          ref.current = null;
        }
      });
      return undefined;
    }
    if (!routeOutlineRef.current) {
      routeOutlineRef.current = new maps.Polyline({
        map: mapInstance,
        path: routePath,
        strokeColor: ROUTE_OUTLINE_COLOR,
        strokeOpacity: 0.45,
        strokeWeight: 9,
        zIndex: 1,
      });
    } else {
      routeOutlineRef.current.setPath(routePath);
    }
    if (!routeStrokeRef.current) {
      routeStrokeRef.current = new maps.Polyline({
        map: mapInstance,
        path: routePath,
        strokeColor: ROUTE_COLOR,
        strokeOpacity: 0.95,
        strokeWeight: 5,
        zIndex: 2,
      });
    } else {
      routeStrokeRef.current.setPath(routePath);
    }
    return undefined;
  }, [mapInstance, maps, showRoute, routePath]);

  /* ---- Fallback: dotted geodesic line while we have no real route ----- */
  useEffect(() => {
    if (!mapInstance || !maps) return undefined;
    const useFallback = showRoute && driver && pickup && (!routePath || routePath.length < 2);
    if (!useFallback) {
      if (fallbackLineRef.current) {
        fallbackLineRef.current.setMap(null);
        fallbackLineRef.current = null;
      }
      return undefined;
    }
    const path = [driver, pickup];
    if (!fallbackLineRef.current) {
      fallbackLineRef.current = new maps.Polyline({
        map: mapInstance,
        path,
        // Dotted line: hide the base stroke and overlay a `DOT` symbol
        // every few pixels so it reads as "approximate while we resolve
        // the real route" rather than a final straight-shot.
        strokeOpacity: 0,
        zIndex: 0,
        icons: [
          {
            icon: {
              path: maps.SymbolPath.CIRCLE,
              fillColor: ROUTE_COLOR,
              fillOpacity: 0.85,
              strokeOpacity: 0,
              scale: 2.5,
            },
            offset: '0',
            repeat: '12px',
          },
        ],
      });
    } else {
      fallbackLineRef.current.setPath(path);
    }
    return undefined;
  }, [mapInstance, maps, showRoute, driver, pickup, routePath]);

  /* ---- Fit map to include both endpoints (and the full route) -------- */
  useEffect(() => {
    if (!mapInstance || !maps || !pickup) return;
    const points = [pickup];
    if (driver) points.push(driver);
    if (dropoff) points.push(dropoff);
    // When a real route is available we widen the bounds to cover the
    // entire path — otherwise a detour around the bounding rectangle
    // would scroll off-screen on initial fit.
    if (Array.isArray(routePath) && routePath.length > 1) {
      points.push(routePath[0], routePath[routePath.length - 1]);
    }
    const key = points.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join('|');
    if (fittedKeyRef.current === key) return;
    fittedKeyRef.current = key;
    if (points.length === 1) {
      mapInstance.panTo(points[0]);
      return;
    }
    const bounds = new maps.LatLngBounds();
    points.forEach((p) => bounds.extend(p));
    if (Array.isArray(routePath)) {
      routePath.forEach((p) => bounds.extend(p));
    }
    mapInstance.fitBounds(bounds, 64);
  }, [mapInstance, maps, driver, pickup, dropoff, routePath]);

  /* ---- Cleanup on unmount -------------------------------------------- */
  useEffect(() => {
    return () => {
      [driverMarkerRef, pickupMarkerRef, dropMarkerRef].forEach((ref) => {
        if (ref.current) {
          ref.current.map = null;
          ref.current = null;
        }
      });
      [routeOutlineRef, routeStrokeRef, fallbackLineRef].forEach((ref) => {
        if (ref.current) {
          ref.current.setMap(null);
          ref.current = null;
        }
      });
      mapRef.current = null;
    };
  }, []);

  /* ---- Distance + ETA derivation ------------------------------------- */
  // Prefer the Directions API's numbers when present — they account for
  // road geometry. Fall back to haversine + an average-speed estimate so
  // the badge never reads "—" just because the API call hasn't returned.
  const { distanceMeters, etaMinutes } = useMemo(() => {
    if (!driver || !pickup) return { distanceMeters: null, etaMinutes: null };
    if (Number.isFinite(routeDistanceMeters) && Number.isFinite(routeDurationSeconds)) {
      return {
        distanceMeters: routeDistanceMeters,
        etaMinutes: Math.max(1, Math.round(routeDurationSeconds / 60)),
      };
    }
    const d = haversineMeters(driver, pickup);
    return { distanceMeters: d, etaMinutes: estimateEtaMinutes(d) };
  }, [driver, pickup, routeDistanceMeters, routeDurationSeconds]);

  useEffect(() => {
    if (!onEtaChange) return;
    onEtaChange({ distanceMeters, etaMinutes });
  }, [distanceMeters, etaMinutes, onEtaChange]);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-gray-50 ${className}`}
      style={{ height }}
    >
      <div ref={containerRef} className="w-full h-full" />
      {!ready && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50/80 pointer-events-none">
          <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-rose-50 p-4 text-center">
          <MapPin className="w-7 h-7 text-rose-400" />
          <p className="text-sm font-medium text-rose-800 mt-2">{error}</p>
        </div>
      )}
      {distanceMeters != null && etaMinutes != null && (
        <div className="absolute top-3 left-3 right-3 flex justify-center pointer-events-none">
          <div className="bg-white/95 backdrop-blur rounded-full shadow px-3.5 py-1.5 flex items-center gap-2 text-[12px] font-semibold text-text">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{formatDistance(distanceMeters)}</span>
            <span className="text-text-muted">·</span>
            <span>~{etaMinutes} min</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default TripTrackingMap;
