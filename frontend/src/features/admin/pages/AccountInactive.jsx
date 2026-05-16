import { ShieldAlert, LogOut } from 'lucide-react';
import Button from '../../../components/Button';
import useAdminAuthStore from '../../../store/useAdminAuthStore';
import { useNavigate } from 'react-router-dom';

const AccountInactive = () => {
  const logout = useAdminAuthStore((state) => state.logout);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-3xl flex items-center justify-center mb-6 animate-bounce">
        <ShieldAlert className="w-10 h-10" />
      </div>
      
      <h1 className="text-3xl font-bold text-slate-900 mb-2">Account Deactivated</h1>
      <p className="text-slate-500 max-w-md mb-8 leading-relaxed">
        Your administrative access has been suspended. You can no longer access the dashboard or manage platform operations. 
        <br/><br/>
        Please contact the <span className="font-bold text-slate-900">Platform Administrator</span> if you believe this is a mistake.
      </p>

      <Button 
        onClick={handleLogout}
        className="flex items-center gap-2 px-8 bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
      >
        <LogOut className="w-4 h-4" />
        Sign Out from Session
      </Button>
    </div>
  );
};

export default AccountInactive;
