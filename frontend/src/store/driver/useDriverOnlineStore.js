import api from '../../utils/api';
import { createQueryStore } from '../lib/createQueryStore';

export const useDriverOnlineStore = createQueryStore(async () => {
  const res = await api.get('/driver/online/status');
  return res.data?.data ?? null;
});
