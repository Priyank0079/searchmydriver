import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Car, CalendarCheck, DollarSign, Settings,
  LogOut, X, ChevronRight, ChevronDown, ShieldCheck, CreditCard, Monitor, Package,
} from 'lucide-react';
import { APP_NAME } from '../../../utils/constants';
import useAdminAuthStore from '../../../store/useAdminAuthStore';

const navItems = [
  { path: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true, roles: ['admin'] },
  { path: '/admin/users', label: 'Users', icon: Users },
  { path: '/admin/drivers', label: 'Drivers', icon: Car },
  { path: '/admin/kits', label: 'Driver Kits', icon: Package, roles: ['admin'] },
  { path: '/admin/kit-orders', label: 'Kit Orders', icon: Package },
  { path: '/admin/bookings', label: 'Bookings', icon: CalendarCheck },
  { path: '/admin/revenue', label: 'Revenue', icon: DollarSign },
  {
    label: 'Settings',
    icon: Settings,
    roles: ['admin'],
    children: [
      { path: '/admin/settings/platform', label: 'Platform Settings', icon: Monitor },
      { path: '/admin/settings/team', label: 'Team Management', icon: ShieldCheck },
      { path: '/admin/settings/payment', label: 'Pricing & Commission', icon: CreditCard },
    ]
  },
];

const Sidebar = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { admin, logout } = useAdminAuthStore();
  const [expandedItems, setExpandedItems] = useState(['Settings']);

  const filteredNavItems = navItems.filter(item => {
    if (!item.roles) return true;
    return item.roles.includes(admin?.role);
  });

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  const toggleExpand = (label) => {
    setExpandedItems(prev =>
      prev.includes(label) ? prev.filter(i => i !== label) : [...prev, label]
    );
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-screen w-[260px] bg-dark flex flex-col transition-transform duration-300 ease-in-out
          lg:translate-x-0 lg:static lg:z-auto
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Logo / Brand */}
        <div className="flex items-center justify-between px-5 h-16 shrink-0 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Car className="w-4.5 h-4.5 text-dark" />
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

        {/* Nav items — scrollable */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 custom-scrollbar">
          <p className="px-3 mb-2 text-[10px] font-semibold text-white/30 uppercase tracking-wider">Main Menu</p>

          {filteredNavItems.map((item) => {
            const hasChildren = item.children && item.children.length > 0;
            const isExpanded = expandedItems.includes(item.label);
            const isActive = item.path ? pathname === item.path : item.children.some(c => pathname === c.path);

            return (
              <div key={item.label} className="space-y-1">
                {hasChildren ? (
                  <button
                    onClick={() => toggleExpand(item.label)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group
                      ${isActive ? 'text-white' : 'text-white/60 hover:bg-white/5 hover:text-white/90'}
                    `}
                  >
                    <item.icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? 'text-primary' : ''}`} />
                    <span className="flex-1 text-left">{item.label}</span>
                    <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>
                ) : (
                  <NavLink
                    to={item.path}
                    end={item.end}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group
                      ${isActive
                        ? 'bg-primary/15 text-primary'
                        : 'text-white/60 hover:bg-white/5 hover:text-white/90'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? 'text-primary' : ''}`} />
                        <span className="flex-1">{item.label}</span>
                        {isActive && <ChevronRight className="w-4 h-4 opacity-60" />}
                      </>
                    )}
                  </NavLink>
                )}

                {/* Sub-menu items */}
                {hasChildren && isExpanded && (
                  <div className="ml-9 space-y-1 animate-in slide-in-from-top-1 duration-200">
                    {item.children.map((child) => (
                      <NavLink
                        key={child.path}
                        to={child.path}
                        onClick={onClose}
                        className={({ isActive }) =>
                          `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200
                          ${isActive ? 'text-primary bg-primary/5' : 'text-white/40 hover:text-white/80 hover:bg-white/5'}`
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

        {/* Footer / Logout */}
        <div className="p-3 border-t border-white/10 shrink-0">
          <button
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
