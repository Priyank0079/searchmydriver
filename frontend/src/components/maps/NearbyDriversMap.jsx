import { useEffect, useRef, useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import { useGoogleMaps } from '../../hooks/useGoogleMaps';
import { useDriverMarkers } from '../../hooks/useDriverMarkers';
import { GOOGLE_MAP_ID } from '../../constants/mapDefaults';
import {
  PIN_ASSETS,
  RAPIDO_MAP_OPTIONS,
  createImageMarkerContent,
} from '../../constants/mapTheme';

/**
 * Reusable Google Map that shows a user pin in the centre, a translucent
 * radius ring around it, and a marker for each nearby driver. The component
 * is purely visual — fetch your drivers with `useNearbyDrivers` and pass
 * them in.
 *
 *   props:
 *     - center           { lat, lng } — required. The map pans here on
 *                        meaningful changes and the user pin sits on it.
 *     - drivers          [{ _id, lat, lng, isOnTrip }] — driver pins.
 *     - radiusMeters     Draws a translucent circle of this radius. Set to
 *                        `null` to hide the ring.
 *     - selectedDriverId Highlights the selected driver pin.
 *     - onDriverClick    Called with the driver object when a pin is tapped.
 *     - height           CSS height. Default `100%`.
 *     - className        Extra wrapper classes.
 *     - fitToDrivers     When true, fits the viewport to include all driver
 *                        pins on the first render after data arrives.
 */
const NearbyDriversMap = ({
  center,
  drivers = [],
  radiusMeters = 2000,
  selectedDriverId = null,
  onDriverClick,
  height = '100%',
  className = '',
  fitToDrivers = true,
}) => {
  const { maps, AdvancedMarkerElement, ready, error } = useGoogleMaps();
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [mapInstance, setMapInstance] = useState(null);

  const userMarkerRef = useRef(null);
  const radiusCircleRef = useRef(null);
  const lastFitKeyRef = useRef(null);

  /* ---- Init map (once) ----------------------------------------------- */

  useEffect(() => {
    if (!ready || !maps || !mapRef.current || mapInstanceRef.current) return;
    // `center` is only read on mount; subsequent updates flow through the
    // recenter effect below. Intentionally not in deps to keep map init
    // a one-shot.
    const initialCenter = center || { lat: 0, lng: 0 };
    mapInstanceRef.current = new maps.Map(mapRef.current, {
      ...RAPIDO_MAP_OPTIONS,
      center: initialCenter,
      zoom: 15,
      mapId: GOOGLE_MAP_ID,
    });
    setMapInstance(mapInstanceRef.current);

    userMarkerRef.current = new AdvancedMarkerElement({
      map: mapInstanceRef.current,
      position: initialCenter,
      content: createImageMarkerContent(PIN_ASSETS.CURRENT_LOCATION, {
        size: 46,
        alt: 'You are here',
      }),
      title: 'You are here',
      zIndex: 5,
    });

    if (radiusMeters && radiusMeters > 0) {
      radiusCircleRef.current = new maps.Circle({
        map: mapInstanceRef.current,
        center: initialCenter,
        radius: radiusMeters,
        strokeColor: '#1F8A4C',
        strokeOpacity: 0.55,
        strokeWeight: 1.5,
        fillColor: '#1F8A4C',
        fillOpacity: 0.08,
        clickable: false,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, maps, AdvancedMarkerElement]);

  /* ---- Recenter the user pin + ring whenever centre changes ---------- */

  useEffect(() => {
    if (!ready || !center || !mapInstanceRef.current) return;
    const position = { lat: center.lat, lng: center.lng };
    if (userMarkerRef.current) {
      userMarkerRef.current.position = position;
    }
    if (radiusCircleRef.current) {
      radiusCircleRef.current.setCenter(position);
    }
    // Recenter only if the user pin would otherwise leave the visible area.
    const bounds = mapInstanceRef.current.getBounds?.();
    if (!bounds || !bounds.contains(position)) {
      mapInstanceRef.current.panTo(position);
    }
  }, [ready, center]);

  /* ---- Update radius ring when radius changes ------------------------ */

  useEffect(() => {
    if (!ready || !mapInstanceRef.current) return;
    if (!radiusMeters || radiusMeters <= 0) {
      if (radiusCircleRef.current) {
        radiusCircleRef.current.setMap(null);
        radiusCircleRef.current = null;
      }
      return;
    }
    if (!radiusCircleRef.current) {
      radiusCircleRef.current = new maps.Circle({
        map: mapInstanceRef.current,
        center: center || { lat: 0, lng: 0 },
        radius: radiusMeters,
        strokeColor: '#1F8A4C',
        strokeOpacity: 0.55,
        strokeWeight: 1.5,
        fillColor: '#1F8A4C',
        fillOpacity: 0.08,
        clickable: false,
      });
    } else {
      radiusCircleRef.current.setRadius(radiusMeters);
    }
  }, [ready, radiusMeters, maps, center]);

  /* ---- Driver markers (shared logic) --------------------------------- */

  useDriverMarkers(mapInstance, drivers, {
    selectedId: selectedDriverId,
    onDriverClick,
  });

  /* ---- Fit map to include all drivers on first data arrival ---------- */

  useEffect(() => {
    if (!ready || !fitToDrivers || !mapInstanceRef.current || !center) return;
    if (drivers.length === 0) return;
    const key = drivers
      .map((d) => `${d._id || d.driverId}:${d.lat?.toFixed?.(4)}:${d.lng?.toFixed?.(4)}`)
      .join('|');
    if (lastFitKeyRef.current === key) return;
    lastFitKeyRef.current = key;

    const bounds = new maps.LatLngBounds();
    bounds.extend({ lat: center.lat, lng: center.lng });
    drivers.forEach((d) => bounds.extend({ lat: d.lat, lng: d.lng }));
    mapInstanceRef.current.fitBounds(bounds, 64);
  }, [ready, fitToDrivers, drivers, center, maps]);

  /* ---- Cleanup ------------------------------------------------------- */

  useEffect(() => {
    return () => {
      if (radiusCircleRef.current) {
        radiusCircleRef.current.setMap(null);
        radiusCircleRef.current = null;
      }
      if (userMarkerRef.current) {
        userMarkerRef.current.map = null;
        userMarkerRef.current = null;
      }
      mapInstanceRef.current = null;
    };
  }, []);

  return (
    <div
      className={`relative overflow-hidden bg-gray-50 ${className}`}
      style={{ height }}
    >
      <div ref={mapRef} className="w-full h-full" />
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
    </div>
  );
};

export default NearbyDriversMap;
