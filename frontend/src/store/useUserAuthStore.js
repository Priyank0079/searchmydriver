import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const useUserAuthStore = create(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      onboarding: null,

      setAuth: (user) => set({ user, isAuthenticated: !!user }),
      setOnboarding: (onboarding) => set({ onboarding }),
      logout: () => set({ user: null, isAuthenticated: false, onboarding: null }),
    }),
    {
      name: 'user-session',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);

export default useUserAuthStore;
