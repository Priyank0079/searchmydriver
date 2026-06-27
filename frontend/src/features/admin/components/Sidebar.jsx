import { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Car, CalendarCheck, DollarSign, Settings,
  LogOut, X, ChevronRight, ChevronDown, ShieldCheck, Monitor, Package,
  CheckSquare, MapPin, Receipt, Sparkles, Navigation, Wallet, Banknote,
  LifeBuoy, ClipboardList, Timer, Megaphone, Compass, LayoutTemplate, Headset,
} from 'lucide-react';
import { APP_NAME } from '../../../utils/constants';
import useAdminAuthStore from '../../../store/useAdminAuthStore';
import { roleCanAccess } from '../../../constants/staffRoles';
import { STAFF_PERMISSIONS } from '../../../constants/permissions';

const navItems = [
  {
    path: '/admin',
    label: 'Dashboard',
    icon: LayoutDashboard,
    end: true,
    roles: ['admin'],
  },
  { path: '/admin/users', label: 'Users', icon: Users, roles: ['admin', 'sub_admin'], permission: STAFF_PERMISSIONS.USERS },
  { path: '/admin/incoming-registrations', label: 'Incoming Registrations', icon: LifeBuoy, roles: ['admin', 'sub_admin'], permission: STAFF_PERMISSIONS.INCOMING_REGISTRATIONS },
  { path: '/admin/tasks', label: 'Team Tasks', icon: CheckSquare, permission: STAFF_PERMISSIONS.TEAM_TASKS },
  { path: '/admin/drivers', label: 'Drivers', icon: Car, permission: STAFF_PERMISSIONS.DRIVERS },
  { path: '/admin/drivers/live', label: 'Live Map', icon: Navigation, permission: STAFF_PERMISSIONS.LIVE_MAP },
  { path: '/admin/kit-orders', label: 'Kit Orders', icon: Package, permission: STAFF_PERMISSIONS.KIT_ORDERS },
  // User App Control — manage banners and ads on the customer app
  {
    label: 'User App Control',
    icon: Monitor,
    roles: ['admin', 'sub_admin'],
    children: [
      { path: '/admin/banners', label: 'Banners Control', icon: LayoutTemplate, roles: ['admin', 'sub_admin'], permission: STAFF_PERMISSIONS.BANNERS },
      { path: '/admin/ads', label: 'Ads Control', icon: Megaphone, roles: ['admin', 'sub_admin'], permission: STAFF_PERMISSIONS.ADS },
    ],
  },
  // Web Control — manage banners and tickets raised from the public website
  {
    label: 'Web Control',
    icon: Monitor,
    roles: ['admin', 'sub_admin'],
    children: [
      { path: '/admin/web-banners', label: 'Web Banners', icon: LayoutTemplate, roles: ['admin', 'sub_admin'], permission: STAFF_PERMISSIONS.BANNERS },
      { path: '/admin/web-tickets', label: 'Web Tickets', icon: Headset, roles: ['admin', 'sub_admin'], permission: STAFF_PERMISSIONS.SUPPORT || 'SUPPORT' },
    ],
  },
  {
    label: 'Bookings',
    icon: CalendarCheck,
    roles: ['admin', 'sub_admin', 'team_member'],
    children: [
      {
        path: '/admin/bookings',
        label: 'All Bookings',
        icon: ClipboardList,
        end: true,
        roles: ['admin'],
        permission: STAFF_PERMISSIONS.BOOKINGS_ALL,
      },
      {
        path: '/admin/bookings/scheduled-jobs',
        label: 'Scheduled Jobs',
        icon: Timer,
        roles: ['admin', 'sub_admin'],
        permission: STAFF_PERMISSIONS.BOOKINGS_SCHEDULED,
      },
      {
        path: '/admin/bookings/emergency-pool',
        label: 'Schedule Pool',
        icon: LifeBuoy,
        roles: ['admin', 'sub_admin', 'team_member'],
        permission: STAFF_PERMISSIONS.BOOKINGS_EMERGENCY,
      },
      {
        path: '/admin/bookings/outstation-assignments',
        label: 'Outstation Pool',
        icon: Compass,
        roles: ['admin', 'sub_admin', 'team_member'],
        permission: STAFF_PERMISSIONS.BOOKINGS_OUTSTATION,
      },
      {
        path: '/admin/bookings/subscription-requests',
        label: 'Subscription Requests',
        icon: Sparkles,
        roles: ['admin', 'sub_admin', 'team_member'],
        permission: STAFF_PERMISSIONS.BOOKINGS_SUBSCRIPTION,
      },
    ],
  },
  {
    label: 'Account',
    icon: Wallet,
    roles: ['admin'],
    children: [
      {
        path: '/admin/account/revenue',
        label: 'Revenue',
        icon: DollarSign,
        roles: ['admin'],
        permission: STAFF_PERMISSIONS.ACCOUNT_REVENUE,
      },
      {
        path: '/admin/account/subscription-revenue',
        label: 'Subscription Revenue',
        icon: Sparkles,
        roles: ['admin'],
        permission: STAFF_PERMISSIONS.ACCOUNT_SUB_REVENUE,
      },
      {
        path: '/admin/account/refunds',
        label: 'Refunds',
        icon: Banknote,
        roles: ['admin'],
        permission: STAFF_PERMISSIONS.ACCOUNT_REFUNDS,
      },
    ],
  },
  {
    label: 'Refer & Earn',
    icon: Sparkles,
    roles: ['admin', 'sub_admin'],
    children: [
      {
        path: '/admin/referrals',
        label: 'Referrals List',
        icon: Users,
        roles: ['admin', 'sub_admin'],
        permission: STAFF_PERMISSIONS.REFERRALS,
      },
      {
        path: '/admin/referrals/withdrawals',
        label: 'Withdrawals',
        icon: Banknote,
        roles: ['admin', 'sub_admin'],
        permission: STAFF_PERMISSIONS.REFERRALS,
      },
      {
        path: '/admin/settings/referrals',
        label: 'Settings & Config',
        icon: Settings,
        roles: ['admin', 'sub_admin'],
        permission: STAFF_PERMISSIONS.REFERRALS,
      },
    ],
  },
  {
    path: '/admin/fare-management',
    label: 'Fare Management',
    icon: Receipt,
    roles: ['admin', 'sub_admin'],
    permission: STAFF_PERMISSIONS.FARE_MANAGEMENT,
  },
  {
    label: 'Settings',
    icon: Settings,
    roles: ['admin', 'sub_admin'],
    children: [
      {
        path: '/admin/settings/platform',
        label: 'Platform Settings',
        icon: Monitor,
        roles: ['admin', 'sub_admin'],
        permission: STAFF_PERMISSIONS.SETTINGS_PLATFORM,
      },
      {
        path: '/admin/settings/kits',
        label: 'Driver Kits',
        icon: Package,
        roles: ['admin', 'sub_admin'],
        permission: STAFF_PERMISSIONS.SETTINGS_KITS,
      },
      {
        path: '/admin/settings/zones',
        label: 'Service Zones',
        icon: MapPin,
        roles: ['admin', 'sub_admin'],
        permission: STAFF_PERMISSIONS.SETTINGS_ZONES,
      },
      {
        path: '/admin/settings/team',
        label: 'Team Management',
        icon: ShieldCheck,
        roles: ['admin'],
        permission: STAFF_PERMISSIONS.SETTINGS_TEAM,
      },
    ],
  },
  {
    path: '/admin/driver-wallet',
    label: 'Driver Wallet',
    icon: Wallet,
    roles: ['admin', 'sub_admin'],
    permission: STAFF_PERMISSIONS.DRIVER_WALLET,
  },
  {
    path: '/admin/help-desk',
    label: 'Help Desk',
    icon: Headset,
    roles: ['admin', 'sub_admin'],
    // Fallback to SUPPORT permission, or you can create one if needed
    permission: STAFF_PERMISSIONS.SUPPORT || 'SUPPORT',
  },
];

function checkAccess(item, admin) {
  if (admin.role === 'admin') return true;
  
  // If user has a permissions array, strictly use PBAC.
  if (admin.permissions && Array.isArray(admin.permissions) && admin.permissions.length > 0) {
    // If the item doesn't require any explicit permission (like Dashboard), allow it.
    if (!item.permission) return true;
    return admin.permissions.includes(item.permission);
  }

  // Fallback to role-based access for legacy users
  if (item.roles) return roleCanAccess(item.roles, admin.role);
  
  // Items without roles/permissions are public to all staff
  return true;
}

function filterNavByRole(items, admin) {
  return items
    .filter((item) => checkAccess(item, admin))
    .map((item) => {
      if (!item.children) return item;
      const children = item.children.filter((child) => checkAccess(child, admin));
      if (!children.length) return null;
      return { ...item, children };
    })
    .filter(Boolean);
}

const Sidebar = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { admin, logout } = useAdminAuthStore();
  const [expandedItems, setExpandedItems] = useState([
    'Settings',
    'Account',
    'Bookings',
  ]);

  const filteredNavItems = filterNavByRole(navItems, admin);

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  const toggleExpand = (label) => {
    setExpandedItems((prev) =>
      prev.includes(label) ? prev.filter((i) => i !== label) : [...prev, label],
    );
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-50 h-screen w-[260px] bg-dark flex flex-col transition-transform duration-300 ease-in-out
          lg:translate-x-0 lg:static lg:z-auto
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex items-center justify-between px-5 h-16 shrink-0 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center overflow-hidden shrink-0">
              <img src="/images/logo-smd.png" alt="SearchMyDrivers" className="w-full h-full object-contain p-0.5" />
            </div>
            <div>
              <h1 className="text-white text-sm font-bold leading-tight">{APP_NAME}</h1>
              <p className="text-white/40 text-[10px]">Admin Panel</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 custom-scrollbar">
          <p className="px-3 mb-2 text-[10px] font-semibold text-white/30 uppercase tracking-wider">
            Main Menu
          </p>

          {filteredNavItems.map((item) => {
            const hasChildren = item.children?.length > 0;
            const isExpanded = expandedItems.includes(item.label);
            const isActive = item.path
              ? pathname === item.path
              : item.children.some((c) => pathname === c.path);

            return (
              <div key={item.label} className="space-y-1">
                {hasChildren ? (
                  <button
                    type="button"
                    onClick={() => toggleExpand(item.label)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group
                      ${isActive ? 'text-white' : 'text-white/60 hover:bg-white/5 hover:text-white/90'}
                    `}
                  >
                    <item.icon
                      className={`w-[18px] h-[18px] shrink-0 ${isActive ? 'text-primary' : ''}`}
                    />
                    <span className="flex-1 text-left">{item.label}</span>
                    <ChevronDown
                      className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </button>
                ) : (
                  <NavLink
                    to={item.path}
                    end={item.end}
                    onClick={onClose}
                    className={({ isActive: active }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group
                      ${active ? 'bg-primary/15 text-primary' : 'text-white/60 hover:bg-white/5 hover:text-white/90'}`
                    }
                  >
                    {({ isActive: active }) => (
                      <>
                        <item.icon
                          className={`w-[18px] h-[18px] shrink-0 ${active ? 'text-primary' : ''}`}
                        />
                        <span className="flex-1">{item.label}</span>
                        {active && <ChevronRight className="w-4 h-4 opacity-60" />}
                      </>
                    )}
                  </NavLink>
                )}

                {hasChildren && isExpanded && (
                  <div className="ml-9 space-y-1">
                    {item.children.map((child) => (
                      <NavLink
                        key={child.path}
                        to={child.path}
                        end={child.end}
                        onClick={onClose}
                        className={({ isActive: active }) =>
                          `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200
                          ${active ? 'text-primary bg-primary/5' : 'text-white/40 hover:text-white/80 hover:bg-white/5'}`
                        }
                      >
                        {child.icon && <child.icon className="w-3.5 h-3.5" />}
                        <span>{child.label}</span>
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/10 shrink-0">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/50 hover:bg-danger/15 hover:text-danger transition-all duration-200"
          >
            <LogOut className="w-[18px] h-[18px]" />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
