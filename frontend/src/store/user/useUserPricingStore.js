import { create } from 'zustand';
import api from '../../utils/api';
import { createQueryStore } from '../lib/createQueryStore';

/** Active service-pricing rows visible to the booking flow. */
export const useUserServicePricingsStore = createQueryStore(async () => {
  const res = await api.get('/auth/pricing/services');
  return res.data?.data ?? [];
});

