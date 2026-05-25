import { useEffect, useRef, useState } from 'react';
import api from '../utils/api';

/**
 * Reusable "do we operate at this point?" hook.
 *
 * Whenever the lat/lng changes (and is valid) we debounce and hit
 * `GET /common/zones/check`. Returns:
 *
 *   { status: 'idle' | 'checking' | 'covered' | 'uncovered' | 'error',
 *     zone, error, lastCheckedAt }
 *
 * Consumers should treat `status === 'uncovered'` as the trigger for the
 * "we are not operating here" UI (popup, disabled CTAs, etc.). Use
 * `status === 'covered'` to re-enable booking.
 *
 * Why a single `status` field rather than independent booleans?
 *   - Avoids ambiguity between "haven't checked yet" and "covered".
 *   - Makes it easy to render distinct UI states (initial, loading, ok,
 *     blocked, error) without combining flags.
 *
 * @param {{ lat:number, lng:number } | null} point
 * @param {object} [opts]
 * @param {boolean} [opts.enabled=true]  Skip the network call entirely.
 * @param {number} [opts.debounceMs=350]
 */
export function useZoneCheck(point, { enabled = true, debounceMs = 350 } = {}) {
  const [state, setState] = useState({
    status: 'idle',
    zone: null,
    error: null,
    lastCheckedAt: null,
  });
  const cancelRef = useRef(null);

  const lat = point?.lat;
  const lng = point?.lng;
  const hasPoint = typeof lat === 'number' && typeof lng === 'number';

  useEffect(() => {
    if (!enabled || !hasPoint) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset when inputs go away
      setState({ status: 'idle', zone: null, error: null, lastCheckedAt: null });
      return undefined;
    }

    let cancelled = false;
    cancelRef.current?.();
    setState((s) => ({ ...s, status: 'checking', error: null }));

    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/common/zones/check', {
          params: { lat, lng },
        });
        if (cancelled) return;
        const data = res?.data?.data || {};
        setState({
          status: data.inZone ? 'covered' : 'uncovered',
          zone: data.zone || null,
          error: null,
          lastCheckedAt: Date.now(),
        });
      } catch (err) {
        if (cancelled) return;
        setState({
          status: 'error',
          zone: null,
          error: err?.response?.data?.message || 'Could not check service area',
          lastCheckedAt: Date.now(),
        });
      }
    }, debounceMs);

    cancelRef.current = () => {
      cancelled = true;
      clearTimeout(timer);
    };
    return cancelRef.current;
  }, [enabled, hasPoint, lat, lng, debounceMs]);

  return state;
}
