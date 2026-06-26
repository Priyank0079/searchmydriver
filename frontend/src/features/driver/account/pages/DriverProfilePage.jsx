import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Briefcase, Calendar, Circle, IdCard, Mail, Phone, ShieldCheck, Star, Users, Car, Wallet } from 'lucide-react';
import Avatar from '../../../../components/Avatar';
import Badge from '../../../../components/Badge';
import Card from '../../../../components/Card';
import DriverScreenShell from '../../components/DriverScreenShell';
import { useDriverProfileStore } from '../../../../store/driver/useDriverProfileStore';
import { useCachedQuery } from '../../../../hooks/useCachedQuery';
import { buildCacheKey } from '../../../../store/lib/buildCacheKey';
import useDriverAuthStore from '../../../../store/useDriverAuthStore';
import { formatDate, formatPhone, formatCurrency } from '../../../../utils/formatters';

const APPROVAL_BADGE = {
  approved: { variant: 'success', label: 'Approved' },
  pending: { variant: 'warning', label: 'Onboarding' },
  under_review: { variant: 'info', label: 'Under review' },
  rejected: { variant: 'danger', label: 'Rejected' },
  suspended: { variant: 'danger', label: 'Suspended' },
};

const DriverProfilePage = () => {
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
  const approval = APPROVAL_BADGE[driver.approvalStatus] || { variant: 'default', label: '�' };
  const phone = formatPhone(driver.phone || '');
  const walletBalance = formatCurrency(driver.wallet?.balance || 0);
  const todayEarnings = formatCurrency(driver.todaySummary?.earnings || 0);
  const totalTrips = Number(driver.todaySummary?.trips || 0);
  const ratingValue = Number(driver.rating || 0);
  const ratingCount = Number(driver.ratingCount || 0);
  const vehicleCount = Array.isArray(driver.vehicleExperience) ? driver.vehicleExperience.length : 0;

  const personalRows = useMemo(
    () =>
      [
        { icon: Phone, label: 'Phone', value: phone || '�' },
        { icon: Mail, label: 'Email', value: driver.email || 'Not added' },
        driver.gender ? { icon: Users, label: 'Gender', value: capitalise(driver.gender) } : null,
        driver.dateOfBirth ? { icon: Calendar, label: 'Date of birth', value: formatDate(driver.dateOfBirth) } : null,
      ].filter(Boolean),
    [driver, phone],
  );

  const drivingRows = useMemo(
    () =>
      [
        driver.drivingLicense?.number
          ? {
              icon: IdCard,
              label: 'Driving license',
              value: driver.drivingLicense.number,
              sub: driver.drivingLicense.expiryDate
                ? `Expires ${formatDate(driver.drivingLicense.expiryDate)}`
                : null,
            }
          : null,
        typeof driver.experienceYears === 'number'
          ? {
              icon: Briefcase,
              label: 'Experience',
              value: `${driver.experienceYears} year${driver.experienceYears === 1 ? '' : 's'}`,
            }
          : null,
        driver.availability
          ? {
              icon: Calendar,
              label: 'Availability',
              value: availabilityLabel(driver.availability),
            }
          : null,
        vehicleCount > 0
          ? {
              icon: Car,
              label: 'Registered vehicles',
              value: `${vehicleCount} vehicle${vehicleCount === 1 ? '' : 's'}`,
            }
          : null,
      ].filter(Boolean),
    [driver, vehicleCount],
  );

  if (loading && !profile) {
    return (
      <DriverScreenShell>
        <div className="flex items-center justify-center min-h-full text-text-muted">Loading profile...</div>
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
            {error || 'Failed to load profile'}
          </div>
        </div>
      </DriverScreenShell>
    );
  }

  return (
    <DriverScreenShell
      header={(
        <header className="bg-dark px-4 pt-5 pb-5 rounded-b-3xl">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/driver/account')}
              className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white/80 shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <Avatar
              src={driver.profilePicture || undefined}
              name={driver.name || 'Driver'}
              size="lg"
              online={driver.isOnline}
              className="ring-2 ring-white/20"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white truncate">
                  {driver.name || 'Driver profile'}
                </h1>
                <Badge variant={approval.variant}>{approval.label}</Badge>
              </div>
              <p className="text-xs text-white/70 mt-0.5">{phone || 'No phone added'}</p>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="inline-flex items-center gap-1 text-[11px] text-white/80">
                  <Star className="w-3 h-3 fill-primary text-primary" />
                  {ratingValue ? ratingValue.toFixed(1) : 'New'}
                  {ratingCount > 0 && <span className="text-white/50">({ratingCount})</span>}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] text-white/80">
                  <Circle className={`w-2 h-2 fill-current ${driver.isOnline ? 'text-success' : 'text-white/40'}`} />
                  {driver.isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
          </div>
        </header>
      )}
      bodyClassName="p-4 -mt-3 pb-8 space-y-4"
    >
      <StatsRow todayEarnings={todayEarnings} walletBalance={walletBalance} totalTrips={totalTrips} />

      {personalRows.length > 0 && <Section title="Personal details" rows={personalRows} />}
      {drivingRows.length > 0 && <Section title="Driving credentials" rows={drivingRows} />}

      {Array.isArray(driver.vehicleExperience) && driver.vehicleExperience.length > 0 && (
        <Card className="p-4 space-y-3">
          <p className="text-[11px] uppercase tracking-wide font-semibold text-text-muted">Vehicle experience</p>
          <div className="space-y-2">
            {driver.vehicleExperience.map((entry, index) => (
              <div key={entry._id || index} className="rounded-2xl border border-border-light bg-bg px-3 py-3">
                <p className="text-sm font-semibold text-text">{formatVehicleExperience(entry)}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {driver.kitEligibility && (
        <Card className="p-4 space-y-3">
          <p className="text-[11px] uppercase tracking-wide font-semibold text-text-muted">Kit eligibility</p>
          <div className="flex items-center gap-2 text-sm font-medium">
            <ShieldCheck className={`w-4 h-4 ${driver.kitEligibility.canGoOnline ? 'text-success' : 'text-amber-500'}`} />
            <span className="text-text">
              {driver.kitEligibility.canGoOnline ? 'Eligible to go online' : 'Kit requirements pending'}
            </span>
          </div>
          {Array.isArray(driver.kitEligibility.reasons) && driver.kitEligibility.reasons.length > 0 && (
            <ul className="list-disc pl-5 text-sm text-text-secondary space-y-1">
              {driver.kitEligibility.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <button
        type="button"
        onClick={() => navigate('/driver/account')}
        className="w-full py-3.5 rounded-2xl bg-white border border-border-light text-sm font-semibold text-text shadow-card"
      >
        Back to account
      </button>
    </DriverScreenShell>
  );
};

function StatsRow({ todayEarnings, walletBalance, totalTrips }) {
  const tiles = [
    { label: 'Today', value: todayEarnings, icon: Star, iconClass: 'text-primary' },
    { label: 'Trips', value: String(totalTrips || 0), icon: Car, iconClass: 'text-text-secondary' },
    { label: 'Wallet', value: walletBalance, icon: Wallet, iconClass: 'text-emerald-600' },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {tiles.map((tile) => (
        <Card key={tile.label} padding="p-3" className="flex flex-col items-start gap-1">
          <tile.icon className={`w-4 h-4 ${tile.iconClass}`} />
          <p className="text-sm font-bold text-text leading-tight truncate w-full">{tile.value}</p>
          <p className="text-[10px] text-text-muted uppercase tracking-wide">{tile.label}</p>
        </Card>
      ))}
    </div>
  );
}

function Section({ title, rows }) {
  return (
    <Card className="p-4">
      <p className="text-[11px] uppercase tracking-wide font-semibold text-text-muted mb-3">{title}</p>
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="flex items-start gap-3 rounded-2xl border border-border-light bg-white px-3 py-3">
            <div className="w-8 h-8 rounded-lg bg-bg flex items-center justify-center shrink-0 mt-0.5">
              <row.icon className="w-4 h-4 text-text-secondary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-text-muted">{row.label}</p>
              <p className="text-sm font-semibold text-text break-words">{row.value}</p>
              {row.sub && <p className="text-[11px] text-text-muted mt-0.5">{row.sub}</p>}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function availabilityLabel(value) {
  switch (value) {
    case 'full-time':
      return 'Full time';
    case 'part-time':
      return 'Part time';
    case 'weekends-only':
      return 'Weekends only';
    default:
      return capitalise(value);
  }
}

function capitalise(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatVehicleExperience(entry) {
  const parts = [];
  if (entry.carTypeId?.name) parts.push(entry.carTypeId.name);
  if (entry.brandId?.name) parts.push(entry.brandId.name);
  if (entry.modelId?.name || entry.modelName) parts.push(entry.modelId?.name || entry.modelName);
  if (entry.fuelTypeId?.name) parts.push(entry.fuelTypeId.name);
  return parts.filter(Boolean).join(' � ') || 'Vehicle';
}

export default DriverProfilePage;
