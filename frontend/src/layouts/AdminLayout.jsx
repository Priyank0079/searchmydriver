import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import Sidebar from '../features/admin/components/Sidebar';
import AdminHeader from '../features/admin/components/AdminHeader';
import { useSocketEvent } from '../hooks/useSocket';
import { S2C_EVENTS } from '../constants/socketEvents';

const routeTitles = {
  '/admin': 'Dashboard',
  '/admin/users': 'Manage Users',
  '/admin/drivers': 'Manage Drivers',
  '/admin/tasks': 'Team Tasks',
  '/admin/tasks/activity': 'Task Activity Log',
  '/admin/settings/kits': 'Driver Kits',
  '/admin/kit-orders': 'Kit Orders',
  '/admin/bookings': 'Manage Bookings',
  '/admin/emergency-pool': 'Emergency Pool',
  '/admin/settings': 'Settings',
  '/admin/account/revenue': 'Revenue',
  '/admin/account/refunds': 'Refunds',
  '/admin/profile': 'My Profile',
  '/admin/banners': 'User App Banners',
  '/admin/ads': 'User App Ads',
  '/admin/web-banners': 'Website Banners Control',
  '/admin/web-tickets': 'Website Support Tickets',
  '/admin/web-cities': 'Website Cities Control',
  '/admin/web-faqs': 'Website FAQs Control',
};

const AdminLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  useSocketEvent(S2C_EVENTS.ADMIN_ALERT, (payload) => {
    toast.success(payload.message || 'New Help Desk Ticket', { duration: 5000 });
    const audio = new Audio('/audio/alert_.mp3');
    audio.play().catch(console.error);
  });

  const pageTitle =
    location.pathname.includes('/admin/users/') && location.pathname.endsWith('/profile')
      ? 'User Profile'
      : location.pathname.includes('/admin/drivers/') && location.pathname.endsWith('/profile')
        ? 'Driver Profile'
        : location.pathname.match(/^\/admin\/kit-orders\/[^/]+$/)
          ? 'Kit Order Detail'
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
