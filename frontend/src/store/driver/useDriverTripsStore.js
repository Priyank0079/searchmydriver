import { create } from 'zustand';
import api from '../../utils/api';
import { createQueryStore } from '../lib/createQueryStore';

/**
 * Driver dashboard query stores.
 *
 *   useDriverHomeSummaryStore   → GET /driver/home/summary   (today + rating + active)
 *   useDriverTripsListStore     → GET /driver/trips          (paginated history)
 *   useDriverEarningsStore      → GET /driver/earnings       (today/week/month + chart)
 *   useDriverEarningsLedgerStore → GET /driver/earnings/ledger (paginated all-earnings feed)
 *
 * The first three follow the `createQueryStore` contract used by the rest
 * of the app, so `useCachedQuery` + `buildCacheKey` work out of the box.
 * The ledger store is a regular Zustand store because it owns its own
 * pagination state (Load-more / append) which doesn't map cleanly onto
 * `createQueryStore`'s "single cached payload" model.
 *
 * After a trip terminates (cancel / complete) call:
 *
 *   useDriverHomeSummaryStore.getState().invalidate('driver-home-summary');
 *   useDriverTripsListStore.getState().invalidate('driver-trips-list');
 *   useDriverEarningsStore.getState().invalidate('driver-earnings');
 *   useDriverEarningsLedgerStore.getState().refresh();
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

const EMPTY_LEDGER_TOTALS = Object.freeze({
  tripEarnings: 0,
  cancellationEarnings: 0,
  tripCount: 0,
  cancellationCount: 0,
  total: 0,
});

/**
 * Paginated ledger of every earning the driver has ever received —
 * trip payouts + cancellation shares. Owns its own pagination state
 * so the Earnings page can render an infinite-scroll "Load more" feed.
 *
 *   fetch({ page, limit, append }) — same signature as the user wallet
 *                                    store. `append: true` extends the
 *                                    list (Load more); otherwise the
 *                                    current page is replaced.
 *   refresh()                       — re-fetch page 1 (e.g. after a
 *                                    trip completes/cancellation).
 */
export const useDriverEarningsLedgerStore = create((set, get) => ({
  rows: [],
  totals: { ...EMPTY_LEDGER_TOTALS },
  page: 1,
  limit: 20,
  total: 0,
  pages: 1,
  hasMore: false,
  loading: false,
  fetched: false,
  error: null,

  async fetch({ page = 1, limit = 20, append = false } = {}) {
    set({ loading: true, error: null });
    try {
      const res = await api.get('/driver/earnings/ledger', {
        params: { page, limit },
      });
      const data = res?.data?.data || {};
      const next = Array.isArray(data.rows) ? data.rows : [];
      set((state) => ({
        rows: append ? [...state.rows, ...next] : next,
        totals: data.totals || EMPTY_LEDGER_TOTALS,
        page: Number(data.page) || page,
        limit: Number(data.limit) || limit,
        total: Number(data.total) || 0,
        pages: Number(data.pages) || 1,
        hasMore:
          next.length === limit &&
          page * limit < (Number(data.total) || 0),
        loading: false,
        fetched: true,
      }));
      return data;
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to load earnings';
      set({ loading: false, error: message });
      throw err;
    }
  },

  refresh() {
    return get().fetch({ page: 1, limit: get().limit, append: false });
  },

  reset() {
    set({
      rows: [],
      totals: { ...EMPTY_LEDGER_TOTALS },
      page: 1,
      limit: 20,
      total: 0,
      pages: 1,
      hasMore: false,
      loading: false,
      fetched: false,
      error: null,
    });
  },
}));
