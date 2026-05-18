import { useCallback, useState } from 'react';
import api from '../utils/api';
import useDriverAuthStore from '../store/useDriverAuthStore';
import { useDriverOnlineStore } from '../store/driver/useDriverOnlineStore';
import { useDriverKitActiveStore } from '../store/driver/useDriverKitStore';

export function useDriverOnlineToggle() {
  const updateDriver = useDriverAuthStore((s) => s.updateDriver);
  const [blocked, setBlocked] = useState(null);
  const [toggling, setToggling] = useState(false);

  const refreshStatus = useCallback(async () => {
    const key = 'driver-online-status';
    await useDriverOnlineStore.getState().refresh(key, {});
    return useDriverOnlineStore.getState().entries[key]?.data;
  }, []);

  const setOnline = useCallback(
    async (online) => {
      setToggling(true);
      setBlocked(null);
      try {
        const res = await api.put('/driver/online', { online });
        const data = res.data?.data;
        updateDriver({ isOnline: data.isOnline, canGoOnline: data.canGoOnline });
        useDriverOnlineStore.getState().invalidate('driver-online-status');
        return { success: true, data };
      } catch (err) {
        const payload = err.response?.data;
        if (err.response?.status === 403) {
          setBlocked({
            message: payload?.message || 'Cannot go online',
            code: payload?.data?.code,
            reasons: payload?.data?.reasons || [],
          });
          useDriverKitActiveStore.getState().invalidate('driver-kit-active');
        }
        return { success: false, error: payload?.message };
      } finally {
        setToggling(false);
      }
    },
    [updateDriver],
  );

  return { setOnline, toggling, blocked, clearBlocked: () => setBlocked(null), refreshStatus };
}
