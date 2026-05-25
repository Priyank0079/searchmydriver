import { create } from 'zustand';
import api from '../../utils/api';

/**
 * Client cache for the logged-in user's saved (favourite) locations. Keeps
 * the data centralised so the location-picker sheet, the home screen and the
 * account page all stay in sync after add/delete.
 */

const initialState = {
  items: [],
  loaded: false,
  loading: false,
  error: null,
};

const useUserSavedLocationsStore = create((set, get) => ({
  ...initialState,

  reset: () => set({ ...initialState }),

  /** Fetch the list. Pass `force: true` to bust the in-memory cache. */
  load: async ({ force = false } = {}) => {
    if (!force && (get().loaded || get().loading)) return get().items;
    set({ loading: true, error: null });
    try {
      const res = await api.get('/auth/saved-locations');
      const list = Array.isArray(res?.data?.data) ? res.data.data : [];
      set({ items: list, loaded: true, loading: false });
      return list;
    } catch (err) {
      const message =
        err?.response?.data?.message || 'Could not load your saved locations';
      set({ loading: false, error: message });
      return [];
    }
  },

  add: async (payload) => {
    set({ error: null });
    try {
      const res = await api.post('/auth/saved-locations', payload);
      const created = res?.data?.data;
      if (created?._id) {
        set((s) => {
          const exists = s.items.some(
            (item) => String(item._id) === String(created._id),
          );
          return exists ? s : { items: [created, ...s.items] };
        });
      }
      return created;
    } catch (err) {
      const message = err?.response?.data?.message || 'Could not save location';
      set({ error: message });
      throw new Error(message, { cause: err });
    }
  },

  remove: async (id) => {
    set({ error: null });
    const prev = get().items;
    set({ items: prev.filter((item) => String(item._id) !== String(id)) });
    try {
      await api.delete(`/auth/saved-locations/${id}`);
    } catch (err) {
      set({ items: prev, error: err?.response?.data?.message || 'Could not remove location' });
      throw err;
    }
  },
}));

export default useUserSavedLocationsStore;
