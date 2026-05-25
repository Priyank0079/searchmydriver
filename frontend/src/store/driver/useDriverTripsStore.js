import api from '../../utils/api';
import { createQueryStore } from '../lib/createQueryStore';

/**
 * Driver dashboard query stores.
 *
 *   useDriverHomeSummaryStore  → GET /driver/home/summary  (today + rating + active)
 *   useDriverTripsListStore    → GET /driver/trips         (paginated history)
 *   useDriverEarningsStore     → GET /driver/earnings      (today/week/month + chart)
 *
 * All three follow the same `createQueryStore` contract used by the rest of
 * the app, so `useCachedQuery` + `buildCacheKey` work out of the box.
 *
 * After a trip terminates (cancel / complete) call:
 *
 *   useDriverHomeSummaryStore.getState().invalidate('driver-home-summary');
 *   useDriverTripsListStore.getState().invalidate('driver-trips-list');
 *   useDriverEarningsStore.getState().invalidate('driver-earnings');
 *
 * to surface fresh data on the next render.
 */

export const useDriverHomeSummaryStore = createQueryStore(async () => {
  const res = await api.get('/driver/home/summary');
  return res.data?.data ?? null;
});

export const useDriverTripsListStore = createQueryStore(async (params = {}) => {
  const res = await api.get('/driver/trips', { params });
  return (
    res.data?.data ?? { data: [], pagination: { total: 0, page: 1, pages: 1, limit: 15 } }
  );
});

export const useDriverEarningsStore = createQueryStore(async () => {
  const res = await api.get('/driver/earnings');
  return res.data?.data ?? null;
});
