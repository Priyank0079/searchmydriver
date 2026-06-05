import api from '../../utils/api';
import { createQueryStore } from '../lib/createQueryStore';

export const useAdminBookingsStore = createQueryStore(
  async ({
    page,
    limit,
    search,
    status,
    bookingType,
    serviceType,
    paymentStatus,
    from,
    to,
  }) => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (search) params.append('search', search);
    if (status) params.append('status', status);
    if (bookingType) params.append('bookingType', bookingType);
    if (serviceType) params.append('serviceType', serviceType);
    if (paymentStatus) params.append('paymentStatus', paymentStatus);
    if (from) params.append('from', from);
    if (to) params.append('to', to);

    const res = await api.get(`/admin/bookings?${params.toString()}`);
    const payload = res.data?.data;

    return {
      bookings: payload?.bookings ?? [],
      stats:
        payload?.stats ?? {
          total: 0,
          searching: 0,
          active: 0,
          completed: 0,
          cancelled: 0,
        },
      pagination: { total: payload?.total || 0, pages: payload?.pages || 1 },
    };
  },
);
