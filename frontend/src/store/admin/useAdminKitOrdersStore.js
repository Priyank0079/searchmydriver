import api from '../../utils/api';
import { createQueryStore } from '../lib/createQueryStore';

export const useAdminKitOrdersStore = createQueryStore(async ({ page, limit, search, status, paymentStatus, adminStatus, assigneeId }) => {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (search) params.append('search', search);
  if (status) params.append('status', status);
  if (paymentStatus) params.append('paymentStatus', paymentStatus);
  if (adminStatus) params.append('adminStatus', adminStatus);
  if (assigneeId) params.append('assigneeId', assigneeId);

  const res = await api.get(`/admin/kit-orders?${params.toString()}`);
  const payload = res.data?.data;

  return {
    orders: payload?.data ?? [],
    pagination: payload?.pagination ?? { total: 0, pages: 1 },
  };
});

export const useAdminKitOrderDetailStore = createQueryStore(async ({ orderId }) => {
  const res = await api.get(`/admin/kit-orders/${orderId}`);
  return res.data?.data ?? null;
});
