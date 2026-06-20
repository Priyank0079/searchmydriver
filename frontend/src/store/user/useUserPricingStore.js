import { create } from 'zustand';
import api from '../../utils/api';
import { createQueryStore } from '../lib/createQueryStore';

/** Active service-pricing rows visible to the booking flow. */
export const useUserServicePricingsStore = createQueryStore(async () => {
  const res = await api.get('/auth/pricing/services');
  return res.data?.data ?? [];
});

/** Active subscription plans shown on the home banner + subscriptions page. */
export const useUserSubscriptionPlansStore = createQueryStore(async () => {
  const res = await api.get('/auth/pricing/subscriptions');
  return res.data?.data ?? [];
});

export const useUserSubscriptionStore = create((set) => ({
  mySubscription: null,
  loading: false,
  purchaseLoading: false,

  async fetchMySubscription() {
    set({ loading: true });
    try {
      const res = await api.get('/auth/subscriptions/me');
      const mySubscription = res?.data?.data || null;
      set({ mySubscription, loading: false });
      return mySubscription;
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  async createPurchaseOrder(planId, zoneId) {
    set({ purchaseLoading: true });
    try {
      const res = await api.post('/auth/subscriptions/purchase', { planId, zoneId });
      const order = res?.data?.data || null;
      set({ purchaseLoading: false });
      return order;
    } catch (err) {
      set({ purchaseLoading: false });
      throw err;
    }
  },

  async verifyPurchase({ orderId, paymentId, signature }) {
    set({ purchaseLoading: true });
    try {
      const res = await api.post('/auth/subscriptions/verify-payment', {
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        razorpaySignature: signature,
      });
      const data = res?.data?.data || {};
      if (data.subscription) {
        set({ mySubscription: data.subscription, purchaseLoading: false });
      } else {
        set({ purchaseLoading: false });
      }
      return data;
    } catch (err) {
      set({ purchaseLoading: false });
      throw err;
    }
  },
}));
