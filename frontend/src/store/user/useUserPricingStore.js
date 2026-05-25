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
