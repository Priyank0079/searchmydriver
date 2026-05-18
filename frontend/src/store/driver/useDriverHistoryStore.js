import api from '../../utils/api';
import { createQueryStore } from '../lib/createQueryStore';

export const useDriverOrdersStore = createQueryStore(async () => {
  const res = await api.get('/driver/orders');
  return res.data?.data ?? { orders: [], summary: {} };
});

export const useDriverPaymentHistoryStore = createQueryStore(async () => {
  const res = await api.get('/driver/payments/history');
  return res.data?.data ?? { payments: [], summary: {} };
});
