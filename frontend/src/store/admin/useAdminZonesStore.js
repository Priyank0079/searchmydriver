import api from '../../utils/api';
import { createQueryStore } from '../lib/createQueryStore';

export const useAdminZonesStore = createQueryStore(async () => {
  const res = await api.get('/admin/zones');
  return res.data?.data ?? [];
});
