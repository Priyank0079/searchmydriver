import { create } from 'zustand';
import toast from 'react-hot-toast';
import api from '../utils/api';

const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isInitialized: false,

  fetchNotifications: async (prefix = '/user') => {
    try {
      const res = await api.get(`${prefix}/notifications`);
      const { notifications, unreadCount } = res.data.data;
      set({ notifications, unreadCount, isInitialized: true });
    } catch (err) {
      console.error('Failed to fetch notifications', err);
    }
  },

  handleNewNotification: (notification) => {
    // Show a toast when a new notification arrives in real-time
    const severityMap = {
      info: toast,
      success: toast.success,
      warning: toast,
      error: toast.error,
    };
    const toastFn = severityMap[notification.severity] || toast;
    
    toastFn(notification.title + (notification.body ? `\n${notification.body}` : ''), {
      duration: 5000,
      icon: notification.severity === 'warning' ? '⚠️' : undefined,
    });

    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: state.unreadCount + 1,
    }));
  },

  markAsRead: async (id, prefix = '/user') => {
    // Optimistic UI update
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n._id === id ? { ...n, isRead: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    }));

    try {
      await api.patch(`${prefix}/notifications/${id}/read`);
    } catch (err) {
      console.error('Failed to mark notification as read', err);
    }
  },

  markAllAsRead: async (prefix = '/user') => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
      unreadCount: 0,
    }));

    try {
      await api.patch(`${prefix}/notifications/read-all`);
    } catch (err) {
      console.error('Failed to mark all notifications as read', err);
    }
  },

  reset: () => {
    set({ notifications: [], unreadCount: 0, isInitialized: false });
  },
}));

export default useNotificationStore;
