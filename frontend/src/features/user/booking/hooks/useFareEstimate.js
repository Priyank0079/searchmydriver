import { useEffect, useRef, useState } from 'react';
import api from '../../../../utils/api';

/**
 * Debounced fare-estimate fetcher used by the slab/review screens.
 *
 *   const { estimate, loading, error, refresh } = useFareEstimate(payload);
 *
 * - `payload` is the body the `/auth/bookings/estimate` endpoint expects
 *   (see backend `pricing.controller.js`).
 * - The hook bails out (without firing a request) when `payload` is falsy.
 * - We debounce identical payloads by JSON-stringifying — UI can freely
 *   pass a fresh object on every render without thrashing the network.
 *
 * Optional `onResult(estimate)` is invoked after each successful fetch so
 * callers can mirror the estimate into a draft store without duplicating
 * `useEffect` boilerplate.
 */
export function useFareEstimate(payload, { onResult, debounceMs = 250 } = {}) {
  const [estimate, setEstimate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [seq, setSeq] = useState(0);

  // We compare by JSON because the payload is small and the alternative
  // (memoised individual fields) is much more error-prone for callers.
  const key = payload ? JSON.stringify(payload) : null;
  const onResultRef = useRef(onResult);
  useEffect(() => {
    onResultRef.current = onResult;
  });

  useEffect(() => {
    if (!key) {
      setEstimate(null);
      setError(null);
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.post('/auth/bookings/estimate', JSON.parse(key));
        if (cancelled) return;
        const data = res?.data?.data || null;
        setEstimate(data);
        onResultRef.current?.(data);
      } catch (err) {
        if (cancelled) return;
        setError(err?.response?.data?.message || err?.message || 'Failed to estimate fare');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, debounceMs);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [key, debounceMs, seq]);

  return {
    estimate,
    loading,
    error,
    refresh: () => setSeq((n) => n + 1),
  };
}

export default useFareEstimate;
