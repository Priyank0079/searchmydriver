import { useEffect, useRef } from 'react';
import { PLACES_COUNTRY } from '../constants/mapDefaults';

function parsePlace(place) {
  const loc = place?.geometry?.location;
  if (!loc) return null;
  return {
    lat: typeof loc.lat === 'function' ? loc.lat() : loc.lat,
    lng: typeof loc.lng === 'function' ? loc.lng() : loc.lng,
    name: place.name || '',
    address: place.formatted_address || '',
  };
}

/**
 * Places Autocomplete + geocode on Enter (India). Prevents form submit on Enter.
 */
export function useMapPlaceSearch(inputRef, { maps, map, enabled, onSelect }) {
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!enabled || !maps || !inputRef.current) return undefined;

    let autocomplete = null;
    let geocoder = null;
    let cancelled = false;

    const selectPlace = (result) => {
      if (result) onSelectRef.current(result);
    };

    const geocodeQuery = (query) => {
      if (!query?.trim() || !geocoder) return;
      geocoder.geocode(
        { address: query, componentRestrictions: { country: PLACES_COUNTRY } },
        (results, status) => {
          if (cancelled || status !== 'OK' || !results?.[0]) return;
          const loc = results[0].geometry.location;
          selectPlace({
            lat: loc.lat(),
            lng: loc.lng(),
            name: results[0].address_components?.[0]?.long_name || query,
            address: results[0].formatted_address || query,
          });
        },
      );
    };

    const setup = async () => {
      const { Autocomplete } = await window.google.maps.importLibrary('places');
      if (cancelled || !inputRef.current) return;

      geocoder = new maps.Geocoder();
      autocomplete = new Autocomplete(inputRef.current, {
        componentRestrictions: { country: PLACES_COUNTRY },
        fields: ['geometry', 'name', 'formatted_address'],
      });

      if (map) autocomplete.bindTo('bounds', map);

      autocomplete.addListener('place_changed', () => {
        selectPlace(parsePlace(autocomplete.getPlace()));
      });

      const input = inputRef.current;
      const onKeyDown = (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        e.stopPropagation();

        const place = parsePlace(autocomplete.getPlace());
        if (place) {
          selectPlace(place);
          return;
        }
        geocodeQuery(input.value);
      };

      input.addEventListener('keydown', onKeyDown);

      return () => input.removeEventListener('keydown', onKeyDown);
    };

    let removeKeyListener = () => {};
    setup().then((remove) => {
      if (remove) removeKeyListener = remove;
    });

    return () => {
      cancelled = true;
      removeKeyListener();
      if (autocomplete) maps.event.clearInstanceListeners(autocomplete);
    };
  }, [maps, map, enabled, inputRef]);
}
