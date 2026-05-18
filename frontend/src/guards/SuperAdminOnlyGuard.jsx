import { Navigate, Outlet } from 'react-router-dom';
import useAdminAuthStore from '../store/useAdminAuthStore';
import { isSuperAdmin } from '../constants/staffRoles';

const SuperAdminOnlyGuard = () => {
  const { admin } = useAdminAuthStore();

  if (!isSuperAdmin(admin?.role)) {
    return <Navigate to="/admin/tasks" replace />;
  }

  return <Outlet />;
};

export default SuperAdminOnlyGuard;
