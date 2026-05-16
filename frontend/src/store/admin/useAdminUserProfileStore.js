import api from '../../utils/api';
import { createQueryStore } from '../lib/createQueryStore';

/**
 * User profile — cached per userId (staff + self-service).
 */
export const useAdminUserProfileStore = createQueryStore(async ({ userId }) => {
  const res = await api.get(`/auth/users/${userId}/profile`);
  return res.data?.data ?? null;
});
