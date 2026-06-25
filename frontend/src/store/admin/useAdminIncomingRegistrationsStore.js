import { createQueryStore } from '../lib/createQueryStore';
import api from '../../utils/api';

export const useAdminIncomingRegistrationsStore = createQueryStore(
  async (params) => {
    const res = await api.get('/admin/incoming-registrations', { params });
    return res.data?.data || { drivers: { data: [], pagination: {} }, users: { data: [], pagination: {} } };
  }
);
