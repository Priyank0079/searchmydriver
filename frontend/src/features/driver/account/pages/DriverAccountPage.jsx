import { useNavigate } from 'react-router-dom';
import Card from '../../../../components/Card';
import Avatar from '../../../../components/Avatar';
import { User, FileText, Building2, Car, HelpCircle, Settings, LogOut, ChevronRight } from 'lucide-react';

const menuItems = [
  { icon: User, label: 'My Profile' },
  { icon: FileText, label: 'Documents' },
  { icon: Building2, label: 'Bank Details' },
  { icon: Car, label: 'Vehicle Preferences' },
  { icon: HelpCircle, label: 'Help & Support' },
  { icon: Settings, label: 'Settings' },
];

const DriverAccountPage = () => {
  const navigate = useNavigate();

  return (
    <div className="flex-1 flex flex-col bg-bg">
      <div className="bg-white px-4 pt-6 pb-6 shadow-sm">
        <div className="flex items-center gap-4">
          <Avatar name="Ravi Kumar" size="xl" />
          <div>
            <h1 className="text-lg font-bold">Ravi Kumar</h1>
            <p className="text-sm text-text-secondary">+91 98765 43210</p>
          </div>
        </div>
      </div>
      <div className="flex-1 p-4">
        <Card className="divide-y divide-border-light">
          {menuItems.map((item, idx) => (
            <button key={idx}
              className="w-full flex items-center gap-3 py-3.5 px-1 hover:bg-gray-50 transition-colors first:pt-1 last:pb-1">
              <div className="w-9 h-9 rounded-lg bg-bg flex items-center justify-center shrink-0">
                <item.icon className="w-5 h-5 text-text-secondary" />
              </div>
              <span className="flex-1 text-left text-sm font-medium">{item.label}</span>
              <ChevronRight className="w-4 h-4 text-text-muted" />
            </button>
          ))}
        </Card>
        <button className="w-full mt-4 flex items-center justify-center gap-2 py-3.5 bg-white rounded-2xl shadow-card text-danger font-medium text-sm hover:bg-danger-light transition-colors">
          <LogOut className="w-5 h-5" />
          Logout
        </button>
      </div>
    </div>
  );
};

export default DriverAccountPage;
