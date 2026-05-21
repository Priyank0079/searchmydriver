import api from '../../utils/api';
import { createQueryStore } from '../lib/createQueryStore';

export const useAdminSubscriptionsStore = createQueryStore(async () => {
  const res = await api.get('/admin/pricing/subscriptions');
  return res.data?.data ?? [];
});
