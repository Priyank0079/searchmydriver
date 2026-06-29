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
      if (payload.notification) {
        // Trigger a proper native system push notification instead of an alert dialog
        if (Notification.permission === 'granted') {
          new Notification(payload.notification.title, {
            body: payload.notification.body,
            icon: '/favicon.svg',
          });
        } else {
          console.warn('[FCM] Notification permission is not granted; cannot display foreground push.');
        }
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [isUserAuthenticated, isDriverAuthenticated]);
}
