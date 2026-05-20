import { useEffect, useState } from 'react';
import { importLibrary, setOptions } from '@googlemaps/js-api-loader';

let loadPromise = null;

export const MAPS_SETUP_HELP =
  'Enable Maps JavaScript API, Places API, and Geocoding API; add http://localhost:5173/* to key referrers.';

async function loadGoogleMaps() {
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim();
  if (!key) {
    throw new Error('Add VITE_GOOGLE_MAPS_API_KEY to frontend/.env');
  }

  if (!loadPromise) {
    setOptions({ key, v: 'weekly' });
    loadPromise = Promise.all([
      importLibrary('maps'),
      importLibrary('marker'),
      importLibrary('geometry'),
      importLibrary('places'),
    ]).then(async () => {
      if (!window.google?.maps) throw new Error('Google Maps failed to initialize');
      const { AdvancedMarkerElement, PinElement } = await window.google.maps.importLibrary('marker');
      return { maps: window.google.maps, AdvancedMarkerElement, PinElement };
    });
  }

  return loadPromise;
}

export function useGoogleMaps() {
  const [mapApi, setMapApi] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const onAuthFailure = () => {
      setError(`Maps API key was rejected. ${MAPS_SETUP_HELP}`);
    };
    window.gm_authFailure = onAuthFailure;

    let cancelled = false;
    loadGoogleMaps()
      .then((api) => {
        if (!cancelled) setMapApi(api);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || 'Failed to load Google Maps');
      });

    return () => {
      cancelled = true;
      if (window.gm_authFailure === onAuthFailure) delete window.gm_authFailure;
    };
  }, []);

  return {
    maps: mapApi?.maps ?? null,
    AdvancedMarkerElement: mapApi?.AdvancedMarkerElement ?? null,
    PinElement: mapApi?.PinElement ?? null,
    ready: Boolean(mapApi?.maps && mapApi?.AdvancedMarkerElement),
    error,
  };
}
