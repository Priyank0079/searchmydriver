import api from '../../utils/api';
import { createQueryStore } from '../lib/createQueryStore';

export const useAdminDriversStore = createQueryStore(async ({ page, limit, search, status }) => {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (search) params.append('search', search);
  if (status) params.append('status', status);

  const res = await api.get(`/admin/drivers?${params.toString()}`);
  const payload = res.data?.data;

  return {
    drivers: payload?.data ?? [],
    pagination: payload?.pagination ?? { total: 0, pages: 1 },
  };
});
