import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../../../components/Card';
import Avatar from '../../../../components/Avatar';
import {
  User,
  Car,
  CreditCard,
  Wallet,
  Users,
  HelpCircle,
  Settings,
  LogOut,
  ChevronRight,
  Sparkles,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import useUserAuthStore from '../../../../store/useUserAuthStore';
import useUserWalletStore from '../../../../store/user/useUserWalletStore';
import { useUserSubscriptionStore } from '../../../../store/user/useUserPricingStore';
import { useUserProfileStore } from '../../../../store/user/useUserProfileStore';
import ConfirmDialog from '../../../../components/ConfirmDialog';
import { useCachedQuery } from '../../../../hooks/useCachedQuery';
import { buildCacheKey } from '../../../../store/lib/buildCacheKey';
import api from '../../../../utils/api';
import toast from 'react-hot-toast';

const menuItems = [
  { id: 'profile', icon: User, label: 'My Profile', path: '/user/account/profile' },
  { id: 'cars', icon: Car, label: 'My Cars', path: '/user/my-cars' },
  { id: 'subscription', icon: Sparkles, label: 'My Subscription', path: '/user/account/subscription', dynamic: 'subscription' },
  { id: 'payments', icon: CreditCard, label: 'Payment Methods', path: '/user/account/payment-methods' },
  { id: 'wallet', icon: Wallet, label: 'My Wallet', path: '/user/wallet', dynamic: 'wallet' },
  { id: 'refer', icon: Users, label: 'Refer & Earn', path: '/user/refer' },
  { id: 'privacy', icon: ShieldCheck, label: 'Privacy Policy', path: '/user/privecy' },
  { id: 'help', icon: HelpCircle, label: 'Help & Support', path: '/user/account/help' },
  { id: 'settings', icon: Settings, label: 'Settings', path: '/user/account/settings' },
];

const UserAccountPage = () => {
  const navigate = useNavigate();
  const user = useUserAuthStore((s) => s.user);
  const logout = useUserAuthStore((s) => s.logout);
  const wallet = useUserWalletStore((s) => s.wallet);
  const fetchWallet = useUserWalletStore((s) => s.fetchWallet);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const mySubscription = useUserSubscriptionStore((s) => s.mySubscription);
  const fetchMySubscription = useUserSubscriptionStore((s) => s.fetchMySubscription);
  const profileKey = buildCacheKey('user-profile', { userId: user?._id || '' });
  const { data: profile, refetch } = useCachedQuery(useUserProfileStore, profileKey, { userId: user?._id || '' });

  useEffect(() => {
    fetchWallet().catch(() => {});
    fetchMySubscription().catch(() => {});
    refetch().catch(() => {});
  }, [fetchWallet, fetchMySubscription, refetch]);

  useEffect(() => {
    if (!profile?.user) return;
    useUserAuthStore.getState().setAuth(profile.user);
  }, [profile]);

  const subscriptionLabel = useMemo(() => {
    if (!mySubscription?._id) return 'No active plan';
    return mySubscription.planNameSnapshot || mySubscription.planId?.name || 'Active';
  }, [mySubscription]);

  const walletLabel = useMemo(
    () =>
      `\u20B9${Number(wallet.balance || 0).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
      })}`,
    [wallet.balance],
  );

  const displayUser = profile?.user || user || {};
  const carCount = Number(profile?.carsCount || 0);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleDeleteAccount = async () => {
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
    <div className="flex-1 flex flex-col bg-bg">
      {/* Profile Header */}
      <div className="bg-white px-4 pt-6 pb-6 shadow-sm">
        <div className="flex items-center gap-4">
          <Avatar name={displayUser?.name || 'Customer'} size="xl" />
          <div>
            <h1 className="text-xl font-bold text-text">{displayUser?.name || 'My Account'}</h1>
            <p className="text-sm text-text-secondary">
              {displayUser?.phone_no ? `+91 ${displayUser.phone_no}` : ''}
            </p>
            <p className="text-xs text-text-muted mt-1">
              {carCount ? `${carCount} car${carCount === 1 ? '' : 's'} linked` : 'No cars linked yet'}
            </p>
          </div>
        </div>
      </div>

      {/* Menu */}
      <div className="flex-1 p-4">
        <Card className="divide-y divide-border-light">
          {menuItems.map((item) => {
            const sub =
              item.dynamic === 'wallet'
                ? walletLabel
                : item.dynamic === 'subscription'
                  ? subscriptionLabel
                  : null;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => item.path && navigate(item.path)}
                className="w-full flex items-center gap-3 py-3.5 px-1 hover:bg-gray-50 transition-colors first:pt-1 last:pb-1"
              >
                <div className="w-9 h-9 rounded-lg bg-bg flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-text-secondary" />
                </div>
                <span className="flex-1 text-left text-sm font-medium text-text">
                  {item.label}
                </span>
                {sub && <span className="text-xs font-semibold text-text">{sub}</span>}
                <ChevronRight className="w-4 h-4 text-text-muted" />
              </button>
            );
          })}
        </Card>

        <div className="mt-4 space-y-3">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-white rounded-2xl shadow-card text-danger font-medium text-sm hover:bg-danger-light transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>

          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-white border border-red-200 rounded-2xl shadow-card text-red-600 font-semibold text-sm hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-5 h-5" />
            Delete Account
          </button>
        </div>

        <ConfirmDialog
          open={deleteOpen}
          onClose={() => setDeleteOpen(false)}
          onConfirm={handleDeleteAccount}
          title="Delete your account?"
          description="This permanently deletes your customer account and signs you out. Any active bookings must be finished or cancelled first."
          confirmLabel="Delete account"
          variant="danger"
          loading={deleting}
        />
      </div>
    </div>
  );
};

export default UserAccountPage;
