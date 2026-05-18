import { useNavigate } from 'react-router-dom';
import Card from '../../../../components/Card';
import Avatar from '../../../../components/Avatar';
import useDriverAuthStore from '../../../../store/useDriverAuthStore';
import AccountOrdersSection from '../components/AccountOrdersSection';
import {
  User,
  FileText,
  Building2,
  Car,
  HelpCircle,
  Settings,
  LogOut,
  ChevronRight,
  Package,
  ShoppingBag,
  History,
} from 'lucide-react';

const menuItems = [
  { icon: Package, label: 'Driver Kit', path: '/driver/kit' },
  { icon: ShoppingBag, label: 'My Orders', path: '/driver/orders' },
  { icon: History, label: 'Payment History', path: '/driver/payments' },
  { icon: User, label: 'My Profile' },
  { icon: FileText, label: 'Documents' },
  { icon: Building2, label: 'Bank Details' },
  { icon: Car, label: 'Vehicle Preferences' },
  { icon: HelpCircle, label: 'Help & Support' },
  { icon: Settings, label: 'Settings' },
];

const DriverAccountPage = () => {
  const navigate = useNavigate();
  const driver = useDriverAuthStore((s) => s.driver);
  const logout = useDriverAuthStore((s) => s.logout);

  const displayName =
    [driver?.firstName, driver?.lastName].filter(Boolean).join(' ') || 'Driver';
  const phone = driver?.phone ? `+91 ${driver.phone}` : '';

  return (
    <div className="flex-1 flex flex-col bg-bg">
      <div className="bg-white px-4 pt-6 pb-6 shadow-sm">
        <div className="flex items-center gap-4">
          <Avatar name={displayName} size="xl" />
          <div>
            <h1 className="text-lg font-bold">{displayName}</h1>
            {phone && <p className="text-sm text-text-secondary">{phone}</p>}
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 pb-8">
        <AccountOrdersSection />

        <Card className="divide-y divide-border-light mt-5">
          {menuItems.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => item.path && navigate(item.path)}
              className="w-full flex items-center gap-3 py-3.5 px-1 hover:bg-gray-50 transition-colors first:pt-1 last:pb-1"
            >
              <div className="w-9 h-9 rounded-lg bg-bg flex items-center justify-center shrink-0">
                <item.icon className="w-5 h-5 text-text-secondary" />
              </div>
              <span className="flex-1 text-left text-sm font-medium">{item.label}</span>
              {item.path && <ChevronRight className="w-4 h-4 text-text-muted" />}
            </button>
          ))}
        </Card>

        <button
          type="button"
          onClick={() => {
            logout();
            navigate('/driver/login');
          }}
          className="w-full mt-4 flex items-center justify-center gap-2 py-3.5 bg-white rounded-2xl shadow-card text-danger font-medium text-sm hover:bg-danger-light transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Logout
        </button>
      </div>
    </div>
  );
};

export default DriverAccountPage;
