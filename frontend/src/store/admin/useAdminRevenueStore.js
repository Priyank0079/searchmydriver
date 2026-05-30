import { create } from 'zustand';
import api from '../../utils/api';

/**
 * Admin "Account → Revenue" store.
 *
 * Backend endpoint:
 *   GET /admin/revenue  (server-paginated list + summary aggregates,
 *                        filters: source, search, serviceType, from, to)
 *
 * Pagination + filters live in the store so the admin's last-used view
 * survives a back-nav. Reset is exposed for the logout flow.
 */

const initialState = {
  rows: [],
  totals: { totalAmount: 0, totalCount: 0, bySource: {} },
  loading: false,
  error: null,
  page: 1,
  limit: 20,
  total: 0,
  filters: {
    source: '',
    search: '',
    serviceType: '',
    from: '',
    to: '',
  },
};

const useAdminRevenueStore = create((set, get) => ({
  ...initialState,

  reset() {
    set(initialState);
  },

  setPage(page) {
    set({ page });
    return get().fetchRevenue();
  },

  setFilter(key, value) {
    const filters = { ...get().filters, [key]: value };
    set({ filters, page: 1 });
    return get().fetchRevenue();
  },

  async fetchRevenue() {
    set({ loading: true, error: null });
    try {
      const { page, limit, filters } = get();
      const res = await api.get('/admin/revenue', {
        params: {
          page,
          limit,
          source: filters.source || undefined,
          search: filters.search || undefined,
          serviceType: filters.serviceType || undefined,
          from: filters.from || undefined,
          to: filters.to || undefined,
        },
      });
      const data = res?.data?.data || {};
      set({
        rows: data.rows || [],
        total: data.total || 0,
        totals: data.totals || initialState.totals,
        loading: false,
      });
      return data;
    } catch (err) {
      const message =
        err?.response?.data?.message || err?.message || 'Failed to load revenue';
      set({ error: message, loading: false });
      throw err;
    }
  },
}));

export default useAdminRevenueStore;
