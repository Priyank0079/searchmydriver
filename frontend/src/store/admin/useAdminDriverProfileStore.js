import api from '../../utils/api';
import { createQueryStore } from '../lib/createQueryStore';

export const useAdminDriverProfileStore = createQueryStore(async ({ driverId }) => {
  const res = await api.get(`/admin/drivers/${driverId}`);
  return res.data?.data ?? null;
});
