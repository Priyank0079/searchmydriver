import { Navigate } from 'react-router-dom';
import useAdminAuthStore from '../../../store/useAdminAuthStore';
import { isSuperAdmin } from '../../../constants/staffRoles';
import AdminDashboard from './AdminDashboard';

const AdminHomeRedirect = () => {
  const { admin } = useAdminAuthStore();

  if (isSuperAdmin(admin?.role)) {
    return <AdminDashboard />;
  }

  return <Navigate to="/admin/tasks" replace />;
};

export default AdminHomeRedirect;
