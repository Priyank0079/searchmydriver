import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
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
  Phone,
  Mail,
  Star,
  Wallet,
  IdCard,
  ShieldCheck,
  Circle,
  Calendar,
  Briefcase,
  Compass,
} from 'lucide-react';
import Card from '../../../../components/Card';
import Avatar from '../../../../components/Avatar';
import Badge from '../../../../components/Badge';
import Toggle from '../../../../components/Toggle';
import api from '../../../../utils/api';
import useDriverAuthStore from '../../../../store/useDriverAuthStore';
import { useDriverProfileStore } from '../../../../store/driver/useDriverProfileStore';
import { useDriverHomeSummaryStore } from '../../../../store/driver/useDriverTripsStore';
import { useCachedQuery } from '../../../../hooks/useCachedQuery';
import { buildCacheKey } from '../../../../store/lib/buildCacheKey';
import { formatCurrency, formatPhone, formatDate } from '../../../../utils/formatters';
import DriverScreenShell from '../../components/DriverScreenShell';

/* ------------------------------------------------------------------ */
/* Menu config                                                         */
/* ------------------------------------------------------------------ */

const APPROVAL_BADGE = {
  approved: { variant: 'success', label: 'Approved' },
  pending: { variant: 'warning', label: 'Onboarding' },
  under_review: { variant: 'info', label: 'Under review' },
  rejected: { variant: 'danger', label: 'Rejected' },
  suspended: { variant: 'danger', label: 'Suspended' },
};

const MENU_GROUPS = [
  {
    title: 'Vehicle & kit',
    items: [
      { icon: Package, label: 'Driver Kit', path: '/driver/kit' },
      { icon: ShoppingBag, label: 'My Orders', path: '/driver/orders' },
      { icon: History, label: 'Payment History', path: '/driver/payments' },
      { icon: Car, label: 'Vehicle Preferences' },
    ],
  },
  {
    title: 'Account',
    items: [
      { icon: User, label: 'My Profile' },
      { icon: FileText, label: 'Documents' },
      { icon: Building2, label: 'Bank Details' },
    ],
  },
  {
    title: 'Help',
    items: [
      { icon: HelpCircle, label: 'Help & Support' },
      { icon: Settings, label: 'Settings' },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

const DriverAccountPage = () => {
  const navigate = useNavigate();
  const cachedDriver = useDriverAuthStore((s) => s.driver);
  const updateDriver = useDriverAuthStore((s) => s.updateDriver);
  const logout = useDriverAuthStore((s) => s.logout);

  const profileKey = buildCacheKey('driver-profile', {});
  const summaryKey = buildCacheKey('driver-home-summary', {});
  const { data: profile } = useCachedQuery(useDriverProfileStore, profileKey, {});
  const { data: summary } = useCachedQuery(useDriverHomeSummaryStore, summaryKey, {});

  // Hydrate the persisted auth-store copy so other surfaces (BottomNav badge,
  // kit eligibility prompts, etc) read the freshest fields too.
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

  // Memoise the resolved driver doc so downstream `useMemo`s have a stable
  // reference — `profile || cachedDriver || {}` would otherwise produce a new
  // empty object on every render, defeating memoisation.
  const driver = useMemo(
    () => profile || cachedDriver || {},
    [profile, cachedDriver],
  );
  const displayName = driver?.name || 'Driver';
  const phone = formatPhone(driver?.phone || '');
  const email = driver?.email || '';
  const ratingValue = Number(summary?.rating?.value ?? driver?.rating ?? 0);
  const ratingCount = Number(summary?.rating?.count ?? driver?.ratingCount ?? 0);
  const today = summary?.today || { earnings: 0, trips: 0 };
  const wallet = driver?.wallet || {};
  const approval = APPROVAL_BADGE[driver?.approvalStatus] || {
    variant: 'default',
    label: '—',
  };

  const personalRows = useMemo(
    () =>
      [
        { icon: Phone, label: 'Phone', value: phone || '—' },
        { icon: Mail, label: 'Email', value: email || 'Not added' },
        driver?.gender && {
          icon: User,
          label: 'Gender',
          value: capitalise(driver.gender),
        },
        driver?.dateOfBirth && {
          icon: Calendar,
          label: 'Date of birth',
          value: formatDate(driver.dateOfBirth),
        },
      ].filter(Boolean),
    [driver, phone, email],
  );

  const drivingRows = useMemo(() => {
    const license = driver?.drivingLicense || {};
    return [
      license.number && {
        icon: IdCard,
        label: 'Driving license',
        value: license.number,
        sub: license.expiryDate
          ? `Expires ${formatDate(license.expiryDate)}`
          : null,
      },
      typeof driver?.experienceYears === 'number' && {
        icon: Briefcase,
        label: 'Experience',
        value: `${driver.experienceYears} year${
          driver.experienceYears === 1 ? '' : 's'
        }`,
      },
      driver?.availability && {
        icon: Calendar,
        label: 'Availability',
        value: availabilityLabel(driver.availability),
      },
      Array.isArray(driver?.vehicleExperience) &&
        driver.vehicleExperience.length > 0 && {
          icon: Car,
          label: 'Registered vehicles',
          value: `${driver.vehicleExperience.length} vehicle${
            driver.vehicleExperience.length === 1 ? '' : 's'
          }`,
        },
    ].filter(Boolean);
  }, [driver]);

  const handleLogout = () => {
    logout();
    navigate('/driver/login');
  };

  return (
    <DriverScreenShell
      header={
        <header className="bg-dark px-4 pt-5 pb-5 rounded-b-3xl">
          <div className="flex items-center gap-3">
            <Avatar
              src={driver?.profilePicture || undefined}
              name={displayName}
              size="lg"
              online={driver?.isOnline}
              className="ring-2 ring-white/20"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white truncate">
                  {displayName}
                </h1>
                <Badge variant={approval.variant}>{approval.label}</Badge>
              </div>
              {phone && (
                <p className="text-xs text-white/70 mt-0.5">{phone}</p>
              )}
              <div className="flex items-center gap-3 mt-1.5">
                <span className="inline-flex items-center gap-1 text-[11px] text-white/80">
                  <Star className="w-3 h-3 fill-primary text-primary" />
                  {ratingValue ? ratingValue.toFixed(1) : 'New'}
                  {ratingCount > 0 && (
                    <span className="text-white/50">({ratingCount})</span>
                  )}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] text-white/80">
                  <Circle
                    className={`w-2 h-2 fill-current ${
                      driver?.isOnline ? 'text-success' : 'text-white/40'
                    }`}
                  />
                  {driver?.isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
          </div>
        </header>
      }
      bodyClassName="p-4 -mt-3 pb-8 space-y-4"
    >
      <StatsRow today={today} wallet={wallet} />

      {personalRows.length > 0 && (
        <InfoCard title="Personal details" rows={personalRows} />
      )}

      {drivingRows.length > 0 && (
        <InfoCard title="Driving credentials" rows={drivingRows} />
      )}

      {driver?.bankDetails?.accountNumber && (
        <InfoCard
          title="Bank account"
          rows={[
            {
              icon: Building2,
              label: driver.bankDetails.bankName || 'Bank',
              value: maskAccount(driver.bankDetails.accountNumber),
              sub: driver.bankDetails.ifsc || null,
            },
          ]}
        />
      )}

      <OutstationOptInCard
        initial={!!driver?.availableForOutstation}
        updatedAt={driver?.outstationAvailabilityUpdatedAt || null}
      />

      {MENU_GROUPS.map((group) => (
        <div key={group.title}>
          <p className="px-1 mb-2 text-[11px] uppercase tracking-wide font-semibold text-text-muted">
            {group.title}
          </p>
          <Card padding="p-0">
            <ul className="divide-y divide-border-light">
              {group.items.map((item) => (
                <li key={item.label}>
                  <button
                    type="button"
                    onClick={() => item.path && navigate(item.path)}
                    disabled={!item.path}
                    className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors disabled:opacity-60 disabled:cursor-default text-left"
                  >
                    <div className="w-9 h-9 rounded-lg bg-bg flex items-center justify-center shrink-0">
                      <item.icon className="w-4.5 h-4.5 text-text-secondary" />
                    </div>
                    <span className="flex-1 text-sm font-medium text-text">
                      {item.label}
                    </span>
                    {item.path && (
                      <ChevronRight className="w-4 h-4 text-text-muted" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      ))}

      <button
        type="button"
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 py-3.5 bg-white rounded-2xl shadow-card text-danger font-medium text-sm hover:bg-danger-light transition-colors"
      >
        <LogOut className="w-4 h-4" />
        Logout
      </button>

      <p className="text-center text-[11px] text-text-muted pt-1">
        Driver ID {driver?._id ? short(driver._id) : '—'}
      </p>
    </DriverScreenShell>
  );
};

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

/**
 * Three-up stat tiles for the hero region: today, today's trips, wallet.
 * Kept inline because none of the rendering is reused outside this page.
 */
function StatsRow({ today, wallet }) {
  const tiles = [
    {
      label: 'Today',
      value: formatCurrency(today.earnings || 0),
      icon: Star,
      iconClass: 'text-primary',
    },
    {
      label: 'Trips',
      value: String(today.trips || 0),
      icon: Car,
      iconClass: 'text-text-secondary',
    },
    {
      label: 'Wallet',
      value: formatCurrency(wallet.balance || 0),
      icon: Wallet,
      iconClass: 'text-emerald-600',
    },
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {tiles.map((tile) => (
        <Card
          key={tile.label}
          padding="p-3"
          className="flex flex-col items-start gap-1"
        >
          <tile.icon className={`w-4 h-4 ${tile.iconClass}`} />
          <p className="text-sm font-bold text-text leading-tight truncate w-full">
            {tile.value}
          </p>
          <p className="text-[10px] text-text-muted uppercase tracking-wide">
            {tile.label}
          </p>
        </Card>
      ))}
    </div>
  );
}

/**
 * Driver-side opt-in for the admin-managed outstation queue. Toggling
 * this on means dispatchers can pick this driver for multi-day round
 * trips; toggling off hides the driver from the picker entirely.
 *
 * We do an optimistic UI flip so the toggle feels instant, and roll
 * back if the API rejects (e.g. network down). The persisted profile
 * store is also refetched on success so the surfaced state matches
 * the server.
 */
function OutstationOptInCard({ initial, updatedAt }) {
  const refetchProfile = useDriverProfileStore((s) => s.fetch);
  const profileKey = buildCacheKey('driver-profile', {});
  const [available, setAvailable] = useState(initial);
  const [saving, setSaving] = useState(false);

  // Re-sync local state if the server profile changes (e.g. another
  // device toggled the same field, or the initial fetch landed after
  // the component mounted). Mirroring server-owned state is exactly
  // the case the rule explicitly allows \u2014 silenced with the
  // same convention used elsewhere in this codebase.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mirroring server-fetched value
    setAvailable(initial);
  }, [initial]);

  const onChange = async (next) => {
    if (saving) return;
    setAvailable(next);
    setSaving(true);
    try {
      await api.put('/driver/preferences/outstation-availability', {
        available: next,
      });
      toast.success(
        next
          ? "You're now visible for outstation trips"
          : "You've opted out of outstation trips",
      );
      refetchProfile?.(profileKey, {}, { force: true });
    } catch (err) {
      setAvailable(!next);
      toast.error(
        err?.response?.data?.message ||
          "Couldn't update your outstation preference",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <p className="px-1 mb-2 text-[11px] uppercase tracking-wide font-semibold text-text-muted">
        Trip preferences
      </p>
      <Card padding="p-4">
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              available ? 'bg-primary/15' : 'bg-bg'
            }`}
          >
            <Compass
              className={`w-5 h-5 ${
                available ? 'text-primary' : 'text-text-secondary'
              }`}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text">
                  Available for outstation
                </p>
                <p className="text-[11px] text-text-muted mt-0.5 leading-snug">
                  Outstation trips are multi-day round trips assigned to
                  you by the admin. Turn this on if you can take overnight
                  jobs \u2014 you can switch it off any time.
                </p>
                {updatedAt && (
                  <p className="text-[10px] text-text-muted mt-1.5">
                    Last updated {formatDate(updatedAt)}
                  </p>
                )}
              </div>
              <Toggle
                checked={available}
                onChange={onChange}
                disabled={saving}
              />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function InfoCard({ title, rows }) {
  return (
    <div>
      <p className="px-1 mb-2 text-[11px] uppercase tracking-wide font-semibold text-text-muted">
        {title}
      </p>
      <Card padding="p-0">
        <ul className="divide-y divide-border-light">
          {rows.map((row) => (
            <li
              key={row.label}
              className="flex items-start gap-3 px-4 py-3"
            >
              <div className="w-8 h-8 rounded-lg bg-bg flex items-center justify-center shrink-0 mt-0.5">
                <row.icon className="w-4 h-4 text-text-secondary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-text-muted">{row.label}</p>
                <p className="text-sm font-semibold text-text break-words">
                  {row.value}
                </p>
                {row.sub && (
                  <p className="text-[11px] text-text-muted mt-0.5">{row.sub}</p>
                )}
              </div>
              {row.verified && (
                <ShieldCheck className="w-4 h-4 text-success shrink-0 mt-1" />
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function capitalise(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
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

function maskAccount(num) {
  const s = String(num);
  if (s.length <= 4) return s;
  return `•••• ${s.slice(-4)}`;
}

function short(id) {
  const s = String(id);
  return s.slice(0, 6).toUpperCase();
}

export default DriverAccountPage;
