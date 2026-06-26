import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, Building2, Copy, CreditCard, Hash, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import Card from '../../../../components/Card';
import DriverScreenShell from '../../components/DriverScreenShell';
import { useDriverProfileStore } from '../../../../store/driver/useDriverProfileStore';
import { useCachedQuery } from '../../../../hooks/useCachedQuery';
import { buildCacheKey } from '../../../../store/lib/buildCacheKey';
import useDriverAuthStore from '../../../../store/useDriverAuthStore';
import { formatDate } from '../../../../utils/formatters';

const DriverBankDetailsPage = () => {
  const navigate = useNavigate();
  const cachedDriver = useDriverAuthStore((s) => s.driver);
  const updateDriver = useDriverAuthStore((s) => s.updateDriver);
  const profileKey = buildCacheKey('driver-profile', {});
  const { data: profile, loading, error, refetch } = useCachedQuery(useDriverProfileStore, profileKey, {});

  useEffect(() => {
    if (!profile) return;
    updateDriver({
      name: profile.name,
      phone: profile.phone,
      email: profile.email,
      profilePicture: profile.profilePicture,
      approvalStatus: profile.approvalStatus,
      isOnline: profile.isOnline,
      canGoOnline: profile.canGoOnline,
    });
  }, [profile, updateDriver]);

  useEffect(() => {
    refetch().catch(() => {});
  }, [refetch]);

  const driver = profile || cachedDriver || {};
  const bank = driver.bankDetails || null;

  const copy = async (value, label) => {
    if (!value) return;
    await navigator.clipboard.writeText(String(value));
    toast.success(`${label} copied`);
  };

  if (loading && !profile) {
    return (
      <DriverScreenShell>
        <div className="flex items-center justify-center min-h-full text-text-muted">Loading bank details...</div>
      </DriverScreenShell>
    );
  }

  if (error && !profile) {
    return (
      <DriverScreenShell>
        <div className="p-4 space-y-4">
          <button
            type="button"
            onClick={() => navigate('/driver/account')}
            className="inline-flex items-center gap-2 text-sm font-semibold text-text-secondary"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error || 'Failed to load bank details'}
          </div>
        </div>
      </DriverScreenShell>
    );
  }

  return (
    <DriverScreenShell
      header={(
        <header className="bg-dark px-4 pt-5 pb-5 rounded-b-3xl text-white">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/driver/account')}
              className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white/80 shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-white/60 uppercase tracking-[0.25em]">Bank Details</p>
              <h1 className="text-base font-bold">Payment account</h1>
              <p className="text-xs text-white/70 mt-0.5">Review the bank account linked to your driver payouts.</p>
            </div>
          </div>
        </header>
      )}
      bodyClassName="p-4 -mt-3 pb-8 space-y-4"
    >
      {!bank ? (
        <Card className="p-6 text-center space-y-2">
          <p className="text-sm font-semibold text-text">No bank details available</p>
          <p className="text-sm text-text-secondary">Your payout bank details will appear here once they are added to your profile.</p>
        </Card>
      ) : (
        <>
          <Card className="p-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] uppercase tracking-wide text-text-muted">Account holder</p>
                <h2 className="text-base font-bold text-text break-words">{bank.accountHolderName}</h2>
                <p className="text-xs text-text-muted mt-1">{bank.isVerified ? 'Verified bank account' : 'Pending verification'}</p>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${bank.isVerified ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                <BadgeCheck className="w-3.5 h-3.5" />
                {bank.isVerified ? 'Verified' : 'Pending'}
              </span>
            </div>
          </Card>

          <Card className="p-4 space-y-3">
            <FieldRow label="Bank name" value={bank.bankName} icon={Building2} />
            <FieldRow
              label="Account number"
              value={bank.accountNumber}
              icon={CreditCard}
              actionLabel="Copy"
              onAction={() => copy(bank.accountNumber, 'Account number')}
            />
            <FieldRow label="IFSC code" value={bank.ifscCode} icon={Hash} />
            <FieldRow label="UPI ID" value={bank.upiId || 'Not added'} icon={Wallet} />
            <FieldRow label="Last updated" value={formatDate(driver.updatedAt)} icon={Hash} />
          </Card>

          <Card className="p-4 space-y-2">
            <p className="text-[11px] uppercase tracking-wide font-semibold text-text-muted">Security note</p>
            <p className="text-sm text-text-secondary leading-relaxed">
              Keep your bank details accurate so payouts reach you without delays. If something changes, update your profile or contact support.
            </p>
          </Card>
        </>
      )}
    </DriverScreenShell>
  );
};

function FieldRow({ label, value, icon: Icon, actionLabel, onAction }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border-light bg-bg px-3 py-3">
      <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
        <Icon className="w-4 h-4 text-text-secondary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-text-muted">{label}</p>
        <p className="text-sm font-semibold text-text break-words">{value || '�'}</p>
      </div>
      {onAction && (
        <button type="button" onClick={onAction} className="inline-flex items-center gap-1 text-xs font-semibold text-primary shrink-0">
          <Copy className="w-3.5 h-3.5" />
          {actionLabel || 'Copy'}
        </button>
      )}
    </div>
  );
}

export default DriverBankDetailsPage;
