import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const useDriverAuthStore = create(
  persist(
    (set) => ({
      driver: null,
      isAuthenticated: false,

      setAuth: (driver) => set({ driver, isAuthenticated: !!driver }),
      updateDriver: (updates) => set((state) => ({ driver: { ...state.driver, ...updates } })),
      logout: () => set({ driver: null, isAuthenticated: false }),
    }),
    {
      name: 'driver-session',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);

export default useDriverAuthStore;
