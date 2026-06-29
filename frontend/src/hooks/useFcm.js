import { useEffect } from 'react';
import useUserAuthStore from '../store/useUserAuthStore';
import useDriverAuthStore from '../store/useDriverAuthStore';
import { requestFcmToken, onFcmMessage } from '../config/firebase';
import api from '../utils/api';

export function useFcm() {
  const { isAuthenticated: isUserAuthenticated } = useUserAuthStore();
  const { isAuthenticated: isDriverAuthenticated } = useDriverAuthStore();

  useEffect(() => {
    let active = true;

    async function registerPush() {
      if (!isUserAuthenticated && !isDriverAuthenticated) return;

      console.log('[FCM] Requesting FCM registration...');
      const token = await requestFcmToken();
      if (!token || !active) return;

      console.log('[FCM] Received token:', token);

      try {
        if (isUserAuthenticated) {
          await api.post('/auth/fcm-token', { token });
          console.log('[FCM] Registered token for user successfully');
        } else if (isDriverAuthenticated) {
          await api.post('/driver/fcm-token', { token });
          console.log('[FCM] Registered token for driver successfully');
        }
      } catch (err) {
        console.error('[FCM] Failed to update token on backend:', err);
      }
    }

    registerPush();

    // Setup foreground message listener
    const unsubscribe = onFcmMessage((payload) => {
      console.log('[FCM] Received message in foreground:', payload);
      // You can trigger custom visual notification/toast alerts here
      if (payload.notification) {
        alert(`[Push Notification] ${payload.notification.title}: ${payload.notification.body}`);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [isUserAuthenticated, isDriverAuthenticated]);
}
