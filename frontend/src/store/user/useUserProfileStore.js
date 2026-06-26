import api from '../../utils/api';
import { createQueryStore } from '../lib/createQueryStore';

export const useUserProfileStore = createQueryStore(async ({ userId }) => {
  if (!userId) return null;
  const res = await api.get(`/auth/users/${userId}/profile`);
  return res.data?.data ?? null;
});
