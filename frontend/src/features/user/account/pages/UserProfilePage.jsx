import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Mail, Phone, User, Users, Copy, CheckCircle, AlertCircle } from 'lucide-react';
import Card from '../../../../components/Card';
import Badge from '../../../../components/Badge';
import { useCachedQuery } from '../../../../hooks/useCachedQuery';
import { useUserProfileStore } from '../../../../store/user/useUserProfileStore';
import { buildCacheKey } from '../../../../store/lib/buildCacheKey';
import useUserAuthStore from '../../../../store/useUserAuthStore';
import { formatDate } from '../../../../utils/formatters';
import toast from 'react-hot-toast';

const UserProfilePage = () => {
  const navigate = useNavigate();
  const authUser = useUserAuthStore((s) => s.user);
  const setAuth = useUserAuthStore((s) => s.setAuth);
  const profileKey = buildCacheKey('user-profile', { userId: authUser?._id || '' });
  const { data: profile, loading, error, refetch } = useCachedQuery(
    useUserProfileStore,
    profileKey,
    { userId: authUser?._id || '' },
  );

  useEffect(() => {
    if (authUser?._id) {
      refetch().catch((err) => {
        console.error('Failed to fetch profile:', err);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?._id]);

  useEffect(() => {
    if (!profile?.user) return;
    setAuth(profile.user);
  }, [profile?.user, setAuth]);

  const user = profile?.user || authUser || {};

  const handleCopyReferralCode = () => {
    if (user?.referralCode) {
      navigator.clipboard.writeText(user.referralCode);
      toast.success('Referral code copied!');
    }
  };

  if (loading && !profile) {
    return (
      <ScreenFrame title="My Profile" onBack={() => navigate('/user/account')}>
        <Card className="p-6 text-center text-text-secondary">
          <div className="animate-pulse">Loading profile...</div>
        </Card>
      </ScreenFrame>
    );
  }

  if (error && !profile) {
    return (
      <ScreenFrame title="My Profile" onBack={() => navigate('/user/account')}>
        <Card className="p-4 flex items-start gap-3 text-sm text-rose-700 bg-rose-50 border border-rose-200">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Failed to load profile</p>
            <p className="text-xs mt-1">{error}</p>
            <button 
              onClick={() => refetch()}
              className="mt-2 px-3 py-1 bg-rose-700 text-white rounded-lg text-xs hover:bg-rose-800 transition"
            >
              Retry
            </button>
          </div>
        </Card>
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame title="My Profile" onBack={() => navigate('/user/account')}>
      <Card className="p-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
            {(user?.name || 'U').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold text-text">{user?.name || 'Customer'}</h1>
              <Badge variant={user?.isPhoneVerified ? 'success' : 'warning'}>
                {user?.isPhoneVerified ? 'Verified' : 'Unverified'}
              </Badge>
            </div>
            <p className="text-sm text-text-muted">{user?.email || 'No email added'}</p>
          </div>
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <p className="text-[11px] uppercase tracking-wide font-semibold text-text-muted">Phone</p>
        <div className="flex items-center gap-3 rounded-2xl border border-border-light bg-white px-3 py-3">
          <div className="w-8 h-8 rounded-lg bg-bg flex items-center justify-center shrink-0">
            <Phone className="w-4 h-4 text-text-secondary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-text break-words">{formatPhoneNumber(user?.phone_no)}</p>
          </div>
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <p className="text-[11px] uppercase tracking-wide font-semibold text-text-muted">Email</p>
        <div className="flex items-center gap-3 rounded-2xl border border-border-light bg-white px-3 py-3">
          <div className="w-8 h-8 rounded-lg bg-bg flex items-center justify-center shrink-0">
            <Mail className="w-4 h-4 text-text-secondary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-text break-words">{user?.email || 'Not added'}</p>
          </div>
        </div>
      </Card>

      <InfoCard title="Profile" rows={[
        { icon: User, label: 'Gender', value: user?.gender || 'Not set' },
        { icon: Calendar, label: 'Date of birth', value: user?.dateOfBirth ? formatDate(user.dateOfBirth) : 'Not set' },
      ]} />

      <Card className="p-4 space-y-3">
        <p className="text-[11px] uppercase tracking-wide font-semibold text-text-muted">Referral Code</p>
        <div className="flex items-center gap-2 rounded-2xl border border-border-light bg-white px-3 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-text-muted">Your Code</p>
            <p className="text-sm font-mono font-semibold text-text">{user?.referralCode || 'Not generated'}</p>
          </div>
          {user?.referralCode && (
            <button
              onClick={handleCopyReferralCode}
              className="p-2 hover:bg-bg rounded-lg transition text-text-muted hover:text-primary"
              title="Copy referral code"
            >
              <Copy className="w-4 h-4" />
            </button>
          )}
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <p className="text-[11px] uppercase tracking-wide font-semibold text-text-muted">Cars linked</p>
        {Array.isArray(profile?.cars) && profile.cars.length > 0 ? (
          <div className="space-y-2">
            {profile.cars.map((car) => (
              <div key={car._id} className="rounded-2xl border border-border-light bg-white px-3 py-3">
                <p className="text-sm font-semibold text-text">{formatCar(car)}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-secondary">No cars added yet.</p>
        )}
      </Card>

      <Card className="p-4 space-y-3">
        <p className="text-[11px] uppercase tracking-wide font-semibold text-text-muted">Checklist</p>
        {Array.isArray(profile?.checklist) && profile.checklist.length > 0 ? (
          <div className="space-y-2">
            {profile.checklist.map((item) => (
              <div key={item._id} className="flex items-center justify-between gap-3 rounded-2xl border border-border-light bg-white px-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text">{item.question}</p>
                  <p className="text-xs text-text-muted">{item.isRequired ? 'Required' : 'Optional'}</p>
                </div>
                <span className={`text-xs font-semibold ${item.value === true ? 'text-success' : item.value === false ? 'text-rose-600' : 'text-amber-600'}`}>
                  {item.value === true ? 'Accepted' : item.value === false ? 'Declined' : 'Pending'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-secondary">No checklist items found.</p>
        )}
      </Card>
    </ScreenFrame>
  );
};

function ScreenFrame({ title, onBack, body, children }) {
  return (
    <div className="flex-1 flex flex-col bg-bg min-h-dvh">
      <div className="bg-white px-4 pt-4 pb-4 shadow-sm">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} className="p-2 -ml-2 rounded-xl hover:bg-gray-100" aria-label="Back">
            <ArrowLeft className="w-5 h-5 text-text" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-text">{title}</h1>
            <p className="text-xs text-text-muted">Live profile data</p>
          </div>
        </div>
      </div>
      <div className="flex-1 p-4 space-y-4">{body || children}</div>
    </div>
  );
}

function InfoCard({ title, rows }) {
  return (
    <Card className="p-4 space-y-3">
      <p className="text-[11px] uppercase tracking-wide font-semibold text-text-muted">{title}</p>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-start gap-3 rounded-2xl border border-border-light bg-white px-3 py-3">
            <div className="w-8 h-8 rounded-lg bg-bg flex items-center justify-center shrink-0 mt-0.5">
              <row.icon className="w-4 h-4 text-text-secondary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-text-muted">{row.label}</p>
              <p className="text-sm font-semibold text-text break-words">{row.value}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function formatCar(car) {
  const parts = [car.carTypeId?.name, car.brandId?.name, car.modelId?.name, car.modelName, car.fuelTypeId?.name, car.vehicleNumber].filter(Boolean);
  return parts.join(' ◆ ') || 'Car';
}

function formatPhoneNumber(phone) {
  if (!phone) return 'Not added';
  // If already has +91, return as is
  if (phone.startsWith('+91')) return phone;
  // If 10 digits, add +91
  if (phone.length === 10) return `+91 ${phone}`;
  // Otherwise return as is
  return phone;
}

function maskEmail(email) {
  if (!email || !email.includes('@')) return 'No email';
  // Don't mask, show full email as per screenshot
  return email;
}

export default UserProfilePage;
