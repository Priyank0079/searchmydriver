import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, Shield, Trash2 } from 'lucide-react';
import Card from '../../../../components/Card';
import ConfirmDialog from '../../../../components/ConfirmDialog';
import useUserAuthStore from '../../../../store/useUserAuthStore';
import api from '../../../../utils/api';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const navigate = useNavigate();
  const logout = useUserAuthStore((s) => s.logout);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await api.delete('/auth/account');
      toast.success('Account deleted successfully');
      logout();
      navigate('/login', { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete account');
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-bg min-h-dvh">
      <Header onBack={() => navigate('/user/account')} />
      <div className="flex-1 p-4 space-y-4">
        <Card className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600"><Bell className="w-5 h-5" /></div>
          <div>
            <h2 className="font-semibold text-text">Notifications</h2>
            <p className="text-sm text-text-secondary">Push and SMS alerts are managed by the app and device settings.</p>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center text-sky-600"><Shield className="w-5 h-5" /></div>
          <div>
            <h2 className="font-semibold text-text">Privacy & security</h2>
            <p className="text-sm text-text-secondary">Review your privacy policy and keep your login details secure.</p>
          </div>
        </Card>

        <button type="button" onClick={() => setDeleteOpen(true)} className="w-full flex items-center justify-center gap-2 py-3.5 bg-white border border-red-200 rounded-2xl shadow-card text-red-600 font-semibold text-sm hover:bg-red-50 transition-colors">
          <Trash2 className="w-5 h-5" /> Delete Account
        </button>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete your account?"
        description="This permanently deletes your customer account and signs you out. Any active bookings must be finished or cancelled first."
        confirmLabel="Delete account"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}

function Header({ onBack }) {
  return (
    <div className="bg-white px-4 pt-4 pb-4 shadow-sm">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onBack} className="p-2 -ml-2 rounded-xl hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5 text-text" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-text">Settings</h1>
          <p className="text-xs text-text-muted">Account controls</p>
        </div>
      </div>
    </div>
  );
}
