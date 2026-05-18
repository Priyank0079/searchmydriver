import api from '../../utils/api';
import { createQueryStore } from '../lib/createQueryStore';

export const useAdminKitsStore = createQueryStore(async () => {
  const res = await api.get('/admin/kits');
  return res.data?.data ?? [];
});
