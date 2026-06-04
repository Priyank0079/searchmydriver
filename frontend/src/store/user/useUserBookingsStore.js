import api from '../../utils/api';
import { createQueryStore } from '../lib/createQueryStore';

export const useUserBookingsStore = createQueryStore(async () => {
  const res = await api.get('/auth/bookings');
  return res.data?.data?.bookings ?? [];
});
