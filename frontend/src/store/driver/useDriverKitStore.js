import api from '../../utils/api';
import { createQueryStore } from '../lib/createQueryStore';

export const useDriverKitsListStore = createQueryStore(async () => {
  const res = await api.get('/driver/kits');
  return res.data?.data ?? [];
});

/** @deprecated use useDriverKitsListStore */
export const useDriverKitStore = createQueryStore(async () => {
  const res = await api.get('/driver/kits/mandatory');
  return res.data?.data ?? null;
});

export const useDriverKitActiveStore = createQueryStore(async () => {
  const res = await api.get('/driver/kit-orders/active');
  return res.data?.data ?? null;
});
