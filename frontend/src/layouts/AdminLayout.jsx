import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../features/admin/components/Sidebar';
import AdminHeader from '../features/admin/components/AdminHeader';

const routeTitles = {
  '/admin': 'Dashboard',
  '/admin/users': 'Manage Users',
  '/admin/drivers': 'Manage Drivers',
  '/admin/bookings': 'Manage Bookings',
  '/admin/revenue': 'Revenue Reports',
  '/admin/settings': 'Settings',
};

const AdminLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const pageTitle =
    location.pathname.includes('/admin/users/') && location.pathname.endsWith('/profile')
      ? 'User Profile'
      : location.pathname.includes('/admin/drivers/') && location.pathname.endsWith('/profile')
        ? 'Driver Profile'
        : routeTitles[location.pathname] || 'Admin';

  return (
    <div className="w-full flex h-screen bg-bg overflow-hidden">
      {/* Sidebar — sticky full height */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header — sticky top */}
        <AdminHeader
          title={pageTitle}
          onMenuToggle={() => setSidebarOpen((prev) => !prev)}
        />

        {/* Page content — scrollable */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
