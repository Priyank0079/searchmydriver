import { useState, useEffect } from 'react';
import { Share2, Copy, Gift, Coins, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Card from '../../../../components/Card';
import Button from '../../../../components/Button';
import useUserAuthStore from '../../../../store/useUserAuthStore';
import api from '../../../../utils/api';

export default function ReferAndEarnPage() {
  const user = useUserAuthStore(s => s.user);
  const [stats, setStats] = useState({ totalReferrals: 0, pendingReferrals: 0, totalEarned: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      if (!user?._id) {
        setLoading(false);
        return;
      }

      if (!user?.referralCode) {
        const profileRes = await api.get(`/auth/users/${user._id}/profile`);
        if (profileRes.data?.data?.user) {
          useUserAuthStore.getState().setAuth(profileRes.data.data.user);
        }
      }

      await api.get('/auth/wallet/transactions');
      setLoading(false);
    } catch (err) {
      setLoading(false);
    }
  };

  const referralCode = user?.referralCode || 'LOAD...';
  const shareText = `Use my referral code ${referralCode} to sign up and get a bonus on SearchMyDriver!`;

  const copyCode = () => {
    if (!user?.referralCode) return;
    navigator.clipboard.writeText(user.referralCode);
    toast.success('Referral code copied!');
  };

  const shareCode = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join SearchMyDriver',
          text: shareText,
        });
      } catch (err) {
        console.log('Share failed:', err);
      }
    } else {
      copyCode();
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-bg min-h-dvh">
      <div className="bg-brand text-white pt-12 pb-8 px-6 text-center rounded-b-3xl shadow-md">
        <Gift className="w-16 h-16 mx-auto mb-4 text-white/90" />
        <h1 className="text-3xl font-bold mb-2">Refer & Earn</h1>
        <p className="text-white/80 max-w-xs mx-auto">
          Invite your friends to SearchMyDriver and earn wallet cash when they take their first ride!
        </p>
      </div>

      <div className="px-4 -mt-6">
        <Card className="p-6 text-center shadow-lg">
          <p className="text-sm text-text-muted mb-2 font-medium uppercase tracking-wide">Your Referral Code</p>
          <div className="bg-brand-light/20 border-2 border-brand/20 rounded-xl py-4 mb-6 relative">
            <span className="text-3xl font-mono font-bold tracking-widest text-brand">{referralCode}</span>
          </div>

          <div className="flex gap-4">
            <Button className="flex-1" icon={Copy} variant="outline" onClick={copyCode}>
              Copy Code
            </Button>
            <Button className="flex-1" icon={Share2} onClick={shareCode}>
              Share Now
            </Button>
          </div>
        </Card>
      </div>

      <div className="p-4 mt-4 space-y-4">
        <h2 className="font-bold text-lg px-1">How it works</h2>
        
        <Card className="p-4 flex gap-4 items-start">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <Share2 className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold mb-1">1. Share your code</h3>
            <p className="text-sm text-text-muted">Send your unique referral code to your friends.</p>
          </div>
        </Card>
        
        <Card className="p-4 flex gap-4 items-start">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-semibold mb-1">2. They sign up & ride</h3>
            <p className="text-sm text-text-muted">Your friend signs up using your code and completes their first trip.</p>
          </div>
        </Card>

        <Card className="p-4 flex gap-4 items-start">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
            <Coins className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h3 className="font-semibold mb-1">3. You both earn!</h3>
            <p className="text-sm text-text-muted">You get a referral bonus and they get a sign-up bonus in their wallet.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
