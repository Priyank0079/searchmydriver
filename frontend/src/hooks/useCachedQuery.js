import { useEffect, useCallback, useRef } from 'react';

/**
 * Subscribe to a cached query entry and fetch only when needed.
 *
 * @param {import('zustand').StoreApi} store - Store from createQueryStore()
 * @param {string} cacheKey - From buildCacheKey()
 * @param {object} params - Passed to store.fetch / fetcher
 * @param {{ enabled?: boolean }} options
 */
export function useCachedQuery(store, cacheKey, params, options = {}) {
  const { enabled = true } = options;

  const entry = store((state) => state.entries[cacheKey]);
  const fetch = store((state) => state.fetch);
  const refresh = store((state) => state.refresh);

  const paramsRef = useRef(params);
  paramsRef.current = params;

  useEffect(() => {
    if (!enabled || !cacheKey) return;
    fetch(cacheKey, paramsRef.current).catch(() => {});
  }, [cacheKey, enabled, fetch]);

  const refetch = useCallback(
    () => refresh(cacheKey, paramsRef.current),
    [cacheKey, refresh],
  );

  const isLoading = enabled && (entry?.loading || (!entry?.isFetched && !entry?.error));

  return {
    data: entry?.data ?? null,
    loading: isLoading,
    error: entry?.error ?? null,
    isFetched: entry?.isFetched ?? false,
    fetchedAt: entry?.fetchedAt ?? null,
    refetch,
    refresh: refetch,
  };
}
