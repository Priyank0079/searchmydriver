import api from '../../utils/api';
import { createQueryStore } from '../lib/createQueryStore';

export const useAdminServicePricingStore = createQueryStore(async () => {
  const res = await api.get('/admin/pricing/services');
  return res.data?.data ?? [];
});
