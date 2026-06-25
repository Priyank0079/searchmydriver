import { createQueryStore } from '../lib/createQueryStore';
import api from '../../utils/api';

export const useAdminDriverWalletStore = createQueryStore(
  async (params) => {
    const res = await api.get('/admin/driver-wallet-history', { params });
    return res.data?.data || { data: [], pagination: { total: 0, pages: 1 } };
  }
);
