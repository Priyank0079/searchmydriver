import { useNavigate } from 'react-router-dom';
import Card from '../../../../components/Card';
import Avatar from '../../../../components/Avatar';
import { User, Car, CreditCard, Wallet, Users, HelpCircle, Settings, LogOut, ChevronRight } from 'lucide-react';

const menuItems = [
  { icon: User, label: 'My Profile', path: '#' },
  { icon: Car, label: 'My Cars', path: '/user/my-cars' },
  { icon: CreditCard, label: 'Payment Methods', path: '#' },
  { icon: Wallet, label: 'My Wallet', sub: '₹1,250.00', path: '#' },
  { icon: Users, label: 'Refer & Earn', path: '#' },
  { icon: HelpCircle, label: 'Help & Support', path: '#' },
  { icon: Settings, label: 'Settings', path: '#' },
];

const UserAccountPage = () => {
  const navigate = useNavigate();

  return (
    <div className="flex-1 flex flex-col bg-bg">
      {/* Profile Header */}
      <div className="bg-white px-4 pt-6 pb-6 shadow-sm">
        <div className="flex items-center gap-4">
          <Avatar name="Raj Nagoriya" size="xl" />
          <div>
            <h1 className="text-xl font-bold text-text">My Account</h1>
            <p className="text-sm text-text-secondary">+91 98765 43210</p>
          </div>
        </div>
      </div>

      {/* Menu */}
      <div className="flex-1 p-4">
        <Card className="divide-y divide-border-light">
          {menuItems.map((item, idx) => (
            <button key={idx} onClick={() => navigate(item.path)}
              className="w-full flex items-center gap-3 py-3.5 px-1 hover:bg-gray-50 transition-colors first:pt-1 last:pb-1">
              <div className="w-9 h-9 rounded-lg bg-bg flex items-center justify-center shrink-0">
                <item.icon className="w-5 h-5 text-text-secondary" />
              </div>
              <span className="flex-1 text-left text-sm font-medium text-text">{item.label}</span>
              {item.sub && <span className="text-xs text-text-muted">{item.sub}</span>}
              <ChevronRight className="w-4 h-4 text-text-muted" />
            </button>
          ))}
        </Card>

        {/* Logout */}
        <button className="w-full mt-4 flex items-center justify-center gap-2 py-3.5 bg-white rounded-2xl shadow-card text-danger font-medium text-sm hover:bg-danger-light transition-colors">
          <LogOut className="w-5 h-5" />
          Logout
        </button>
      </div>
    </div>
  );
};

export default UserAccountPage;
