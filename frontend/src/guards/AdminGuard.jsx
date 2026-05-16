import { Outlet, Navigate } from 'react-router-dom';
import useAdminAuthStore from '../store/useAdminAuthStore';

const STAFF_ROLES = ['admin', 'team_member'];

const AdminGuard = () => {
  const { isAuthenticated, admin } = useAdminAuthStore();

  if (!isAuthenticated || !admin || !STAFF_ROLES.includes(admin.role)) {
    return <Navigate to="/admin/login" replace />;
  }

  if (admin.isActive === false) {
    return <Navigate to="/admin/inactive" replace />;
  }

  return <Outlet />;
};

export default AdminGuard;
