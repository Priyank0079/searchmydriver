import { useEffect, useState } from 'react';
import { useGoogleMap, MAPS_SETUP_HELP as SETUP_HELP } from './useGoogleMap';

/**
 * Backwards-compatible wrapper around the canonical `useGoogleMap` hook.
 *
 * Most of the app's older imperative code (zone editor, nearby drivers map,
 * place search, admin live map…) expects the legacy return shape:
 *
 *   { maps, AdvancedMarkerElement, PinElement, ready, error }
 *
 * Rather than rewrite each of those sites at once, we keep the exact same
 * surface here but power it via `useJsApiLoader` (through `useGoogleMap`),
 * so a single loader is shared with the new declarative `<MapView>`,
 * `<DriverMarker>` and `<RoutePolyline>` components.
 *
 * The Advanced Marker / Pin elements only become available once the
 * `marker` library has been resolved by Google's dynamic loader. We trigger
 * that via `google.maps.importLibrary('marker')` and surface the resolved
 * classes through state so a re-render unblocks any code that gated on
 * `ready`.
 */

export const MAPS_SETUP_HELP = SETUP_HELP;

export function useGoogleMaps() {
  const { isLoaded, loadError, maps } = useGoogleMap();
  const [markerLib, setMarkerLib] = useState(null);

  useEffect(() => {
    if (!isLoaded || !maps) return undefined;

    // Fast path: the library was pre-attached by the script tag loader.
    if (maps.marker?.AdvancedMarkerElement && maps.marker?.PinElement) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot publish when API is ready
      setMarkerLib({
        AdvancedMarkerElement: maps.marker.AdvancedMarkerElement,
        PinElement: maps.marker.PinElement,
      });
      return undefined;
    }

    // Otherwise resolve the dynamic import. Google guarantees this is cheap
    // — the library code is already in cache, this just hands back the
    // class references.
    if (typeof maps.importLibrary !== 'function') return undefined;

    let cancelled = false;
    maps
      .importLibrary('marker')
      .then((lib) => {
        if (cancelled) return;
        if (lib?.AdvancedMarkerElement && lib?.PinElement) {
          setMarkerLib({
            AdvancedMarkerElement: lib.AdvancedMarkerElement,
            PinElement: lib.PinElement,
          });
        }
      })
      .catch(() => {
        /* swallow — `ready` stays false, the page-level loader UI handles it */
      });

    return () => {
      cancelled = true;
    };
  }, [isLoaded, maps]);

  // Surface the auth-failure hint Google calls back on bad keys/referrers.
  // Set once, kept until the page unmounts.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onAuthFailure = () => {
      // We can't `setState` from outside a component lifecycle, but we can
      // dispatch a hint that callers will pick up via the next reload.
      console.error(`[Google Maps] Auth failed - ${MAPS_SETUP_HELP}`);
    };
    window.gm_authFailure = onAuthFailure;
    return () => {
      if (window.gm_authFailure === onAuthFailure) delete window.gm_authFailure;
    };
  }, []);

  return {
    maps: isLoaded ? maps : null,
    AdvancedMarkerElement: markerLib?.AdvancedMarkerElement || null,
    PinElement: markerLib?.PinElement || null,
    ready: Boolean(isLoaded && markerLib?.AdvancedMarkerElement),
    error: loadError ? loadError.message || 'Failed to load Google Maps' : null,
  };
}

export default useGoogleMaps;
