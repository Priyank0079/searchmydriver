import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../../../components/Card';
import Badge from '../../../../components/Badge';
import Toggle from '../../../../components/Toggle';
import {
  Star,
  TrendingUp,
  Bell,
  MapPin,
  Navigation,
  AlertCircle,
  ShieldAlert,
  ChevronRight,
  Car,
  Clock,
  ShieldCheck,
  Phone,
  Flag,
} from 'lucide-react';
import { useCachedQuery } from '../../../../hooks/useCachedQuery';
import { buildCacheKey } from '../../../../store/lib/buildCacheKey';
import { useDriverOnlineStore } from '../../../../store/driver/useDriverOnlineStore';
import { useDriverKitActiveStore } from '../../../../store/driver/useDriverKitStore';
import { useDriverHomeSummaryStore } from '../../../../store/driver/useDriverTripsStore';
import { useDriverOnlineToggle } from '../../../../hooks/useDriverOnlineToggle';
import { useDriverLocation } from '../../../../hooks/useDriverLocation';
import useDriverAuthStore from '../../../../store/useDriverAuthStore';
import { formatCurrency } from '../../../../utils/formatters';
import {
  SERVICE_TYPES,
  SERVICE_TYPE_LABELS,
} from '../../../../constants/serviceTypes';
import {
  BOOKING_STATUS,
  ACTIVE_BOOKING_STATUSES,
} from '../../../../constants/bookingStatus';
import OnlineBlockedDialog from '../../kit/components/OnlineBlockedDialog';
import DriverKitHomeCard from '../../kit/components/DriverKitHomeCard';

const ACTIVE_STATUS_COPY = {
  [BOOKING_STATUS.DRIVER_ASSIGNED]: 'Heading to customer',
  [BOOKING_STATUS.AWAITING_PAYMENT]: 'Customer is getting ready',
  [BOOKING_STATUS.EN_ROUTE]: 'On the way to pickup',
  [BOOKING_STATUS.ARRIVED]: 'At pickup — start the ride',
  [BOOKING_STATUS.STARTED]: 'Trip in progress',
};

const DriverHomePage = () => {
  const navigate = useNavigate();
  const updateDriver = useDriverAuthStore((s) => s.updateDriver);
  const onlineKey = buildCacheKey('driver-online-status', {});
  const activeKey = buildCacheKey('driver-kit-active', {});
  const summaryKey = buildCacheKey('driver-home-summary', {});

  const { data: onlineStatus, refetch: refetchOnline } = useCachedQuery(
    useDriverOnlineStore,
    onlineKey,
    {},
  );
  const { refetch: refetchKit } = useCachedQuery(useDriverKitActiveStore, activeKey, {});
  const { data: summary, loading: summaryLoading } = useCachedQuery(
    useDriverHomeSummaryStore,
    summaryKey,
    {},
  );

  const todayEarnings = summary?.today?.earnings ?? 0;
  const todayTrips = summary?.today?.trips ?? 0;
  const driverRating = summary?.rating?.value ?? 0;
  const ratingCount = summary?.rating?.count ?? 0;
  const activeBooking = summary?.activeBooking || null;
  const hasActiveBooking =
    activeBooking && ACTIVE_BOOKING_STATUSES.includes(activeBooking.status);
  const cancellationChances = summary?.cancellationChances || null;

  const { setOnline, toggling, blocked, clearBlocked } = useDriverOnlineToggle();

  const isOnline = onlineStatus?.isOnline ?? false;
  const canGoOnline = onlineStatus?.canGoOnline ?? false;
  const blocker = onlineStatus && !canGoOnline ? onlineStatus : null;
  const needsKitAction = blocker?.code === 'KIT_REQUIRED';
  const hasOtherBlocker = Boolean(blocker) && !needsKitAction;
  const primaryReason = blocker?.reasons?.[0] || null;

  const location = useDriverLocation({ enabled: isOnline });

  useEffect(() => {
    if (onlineStatus) {
      updateDriver({
        isOnline: onlineStatus.isOnline,
        canGoOnline: onlineStatus.canGoOnline,
      });
    }
  }, [onlineStatus, updateDriver]);

  const handleToggle = async (next) => {
    if (next) {
      const result = await setOnline(true);
      if (result.success) refetchOnline();
      return;
    }
    const result = await setOnline(false);
    if (result.success) refetchOnline();
  };

  const handleKitUpdate = () => {
    refetchKit();
    refetchOnline();
  };

  const goToKitPage = () => {
    clearBlocked();
    navigate('/driver/kit');
  };

  return (
    <div className="flex-1 flex flex-col bg-bg">
      <div className="bg-dark px-4 pt-4 pb-6 rounded-b-3xl">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-bold text-white">Home</h1>
          <button type="button" className="relative p-2.5 rounded-xl bg-white/10">
            <Bell className="w-5 h-5 text-white" />
          </button>
        </div>
        <Card className="!bg-white/10 backdrop-blur-sm !shadow-none">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-3 h-3 rounded-full ${isOnline ? 'bg-success animate-pulse' : 'bg-gray-400'}`}
              />
              <div>
                <span className="text-white text-sm font-medium block">
                  {isOnline ? 'You are Online' : 'You are Offline'}
                </span>
                {!isOnline && primaryReason && (
                  <span className="text-white/60 text-[10px]">{primaryReason}</span>
                )}
              </div>
            </div>
            <Toggle checked={isOnline} onChange={handleToggle} disabled={toggling} />
          </div>
        </Card>
      </div>

      <div className="flex-1 p-4 -mt-3 space-y-4 pb-8">
        {needsKitAction && <DriverKitHomeCard onUpdate={handleKitUpdate} />}

        {hasOtherBlocker && (
          <Card className="border-l-4 border-l-amber-500 bg-amber-50/40 animate-fade-in-up">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-text">Cannot go online yet</p>
                <ul className="mt-1.5 space-y-1">
                  {blocker.reasons.map((r) => (
                    <li key={r} className="text-xs text-text-muted leading-relaxed">
                      • {r}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        )}

        {hasActiveBooking && (
          <ActiveTripCard
            booking={activeBooking}
            chance={cancellationChances}
            onResume={() => navigate(`/driver/trip/${activeBooking._id}`)}
          />
        )}

        {!hasActiveBooking && cancellationChances && (
          <CancellationChancesCard chance={cancellationChances} />
        )}

        <Card className="animate-fade-in-up">
          <div className="flex items-center justify-between">
            <p className="text-xs text-text-muted">Today's Earnings</p>
            <button
              type="button"
              onClick={() => navigate('/driver/earnings')}
              className="text-[11px] font-semibold text-primary inline-flex items-center gap-0.5"
            >
              View all <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <p className="text-3xl font-bold text-text mt-1">
            {summaryLoading && !summary ? '—' : formatCurrency(todayEarnings)}
          </p>
          <div className="flex items-center gap-6 mt-3">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-success" />
              <span className="text-sm">
                <strong>{todayTrips}</strong>{' '}
                <span className="text-text-muted">
                  Trip{todayTrips === 1 ? '' : 's'}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Star className="w-4 h-4 text-primary fill-primary" />
              <span className="text-sm">
                <strong>{driverRating ? driverRating.toFixed(1) : '—'}</strong>{' '}
                <span className="text-text-muted">
                  {ratingCount ? `(${ratingCount})` : 'No ratings yet'}
                </span>
              </span>
            </div>
          </div>
        </Card>

        {isOnline && (
          <Card className="animate-fade-in-up border-l-4 border-l-success">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-success-light rounded-full flex items-center justify-center">
                <MapPin className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-sm font-medium text-text">You are online and ready to receive trips</p>
                <p className="text-xs text-text-muted mt-0.5">Incoming requests will appear here</p>
              </div>
            </div>
          </Card>
        )}

        {isOnline && location.error && location.permission === 'denied' && (
          <Card className="animate-fade-in-up border-l-4 border-l-danger">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-danger shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-text">Location permission blocked</p>
                <p className="text-xs text-text-muted mt-1">{location.error}</p>
              </div>
            </div>
          </Card>
        )}

        {isOnline && location.permission !== 'denied' && (
          <Card className="animate-fade-in-up">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  location.isSharing ? 'bg-primary/10' : 'bg-gray-100'
                }`}
              >
                <Navigation
                  className={`w-5 h-5 ${location.isSharing ? 'text-primary animate-pulse' : 'text-gray-400'}`}
                />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-text">
                  {location.isSharing ? 'Sharing live location' : 'Acquiring GPS signal…'}
                </p>
                <p className="text-xs text-text-muted mt-0.5">
                  {location.coords
                    ? `Accuracy ±${Math.round(location.coords.accuracy)}m · updated every 5s`
                    : 'Make sure you are in an open area for a faster fix.'}
                </p>
              </div>
            </div>
          </Card>
        )}

        {!isOnline && canGoOnline && (
          <Card className="border-l-4 border-l-gray-300">
            <p className="text-sm text-text-secondary text-center py-3">
              Turn on the switch above to start receiving booking requests
            </p>
          </Card>
        )}
      </div>

      <OnlineBlockedDialog
        open={Boolean(blocked)}
        onClose={clearBlocked}
        blocked={blocked}
        onGoToKit={goToKitPage}
      />
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

/**
 * "Resume your trip" tile shown on home whenever the driver has a
 * booking in any active status. Tapping anywhere on the card jumps
 * back to the live trip page so the driver can never lose context
 * after closing the app or switching tabs.
 *
 * Rich layout: shows pickup + drop, customer name + phone, fare,
 * duration, and a live "free cancel: 1m 24s left" countdown when the
 * driver is still inside the grace window.
 */
function ActiveTripCard({ booking, chance, onResume }) {
  const status = booking?.status;
  const subtitle = ACTIVE_STATUS_COPY[status] || 'Trip in progress';
  const fare = booking?.fareSnapshot?.driverEarning;
  const serviceLabel =
    SERVICE_TYPE_LABELS[booking?.serviceType] || booking?.serviceType || 'Trip';
  const pickup = booking?.pickup?.address;
  const drop = booking?.dropoff?.address;
  const customer =
    booking?.userId && typeof booking.userId === 'object' ? booking.userId : null;
  const customerName = customer?.name || 'Customer';
  const customerPhone = customer?.phone_no || customer?.phone || null;
  const hours =
    booking?.serviceType === SERVICE_TYPES.HOURLY
      ? booking?.hourly?.durationHours
      : null;

  return (
    <Card
      hoverable
      onClick={onResume}
      className="animate-fade-in-up border-l-4 border-l-primary !p-0 overflow-hidden"
    >
      {/* Top strip: service + earning */}
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <Badge variant="primary">{serviceLabel}</Badge>
          {hours && (
            <span className="text-[11px] text-text-muted">{hours} h booked</span>
          )}
        </div>
        {fare > 0 && (
          <div className="text-right shrink-0">
            <p className="text-[10px] uppercase tracking-wide text-text-muted font-semibold leading-none">
              Your earning
            </p>
            <p className="text-sm font-bold text-emerald-700 leading-tight">
              {formatCurrency(fare)}
            </p>
          </div>
        )}
      </div>

      {/* Status line */}
      <div className="px-4 pb-2 flex items-center gap-2 text-sm font-semibold text-text">
        <Car className="w-4 h-4 text-primary shrink-0" />
        <span className="truncate">{subtitle}</span>
      </div>

      {/* Pickup + drop */}
      <div className="px-4 pb-2 space-y-1.5">
        {pickup && (
          <RouteLine
            tone="text-primary bg-primary/10"
            label="Pickup"
            text={pickup}
          />
        )}
        {drop && (
          <RouteLine
            tone="text-rose-700 bg-rose-100"
            label="Drop"
            text={drop}
          />
        )}
      </div>

      {/* Customer line */}
      {(customerName || customerPhone) && (
        <div className="px-4 pb-2 flex items-center gap-2 text-xs text-text-muted">
          <Phone className="w-3.5 h-3.5" />
          <span className="font-medium text-text">{customerName}</span>
          {customerPhone && (
            <>
              <span>{'\u00B7'}</span>
              <span className="font-mono">{customerPhone}</span>
            </>
          )}
        </div>
      )}

      {/* Live grace countdown when applicable */}
      <ActiveTripGraceFooter chance={chance} />

      {/* Resume CTA strip */}
      <div className="px-4 py-2.5 bg-primary/5 border-t border-primary/10 flex items-center justify-between text-xs font-semibold text-primary">
        <span>Resume trip</span>
        <ChevronRight className="w-4 h-4" />
      </div>
    </Card>
  );
}

function RouteLine({ tone, label, text }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <span
        className={`mt-0.5 px-1.5 py-0.5 rounded-md font-semibold text-[10px] uppercase tracking-wide shrink-0 ${tone}`}
      >
        {label}
      </span>
      <span className="text-text leading-snug line-clamp-2">{text}</span>
    </div>
  );
}

/**
 * Footer strip on the active-trip card that ticks down the remaining
 * grace-window minutes once per second. Hidden when the booking is
 * past grace OR the driver has no free chances left today (in those
 * cases the cancel modal handles all the messaging).
 */
function ActiveTripGraceFooter({ chance }) {
  const [, setHeartbeat] = useState(0);
  useEffect(() => {
    if (!chance?.inGrace) return undefined;
    const id = setInterval(() => setHeartbeat((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [chance?.inGrace]);

  if (!chance) return null;
  const dailyLimit = Number(chance.dailyLimit) || 0;
  const chancesLeft = Math.max(0, Number(chance.chancesLeft) || 0);
  const inGrace = !!chance.inGrace;
  const graceMinutes = Math.max(0, Number(chance.graceMinutes) || 0);

  if (!inGrace || chancesLeft <= 0 || graceMinutes <= 0) return null;

  // Live recompute from the server-provided `remainingMinutes` snapshot
  // (which was already in-grace) decremented by client wall-clock since
  // mount. Without this the countdown would freeze at fetch time.
  const remainingMinutes = Math.max(
    0,
    Number(chance.remainingMinutes) || 0,
  );
  if (remainingMinutes <= 0) return null;

  const totalSec = Math.max(0, Math.floor(remainingMinutes * 60));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const display = m > 0 ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`;

  return (
    <div className="mx-4 mb-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2">
      <Clock className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
      <p className="text-[11px] text-emerald-800 leading-snug">
        Free cancel window:{' '}
        <strong className="font-semibold">{display}</strong> left ·{' '}
        {chancesLeft} of {dailyLimit} free cancellation
        {dailyLimit === 1 ? '' : 's'} today
      </p>
    </div>
  );
}

/**
 * Standalone cancellation-chances tile rendered when the driver has
 * NO active trip — gives them a daily-budget summary at a glance so
 * they don't have to enter a ride to discover how many cancels they
 * have left.
 */
function CancellationChancesCard({ chance }) {
  const dailyLimit = Number(chance?.dailyLimit) || 0;
  const chancesLeft = Math.max(0, Number(chance?.chancesLeft) || 0);
  const used = Number(chance?.usedToday) || 0;
  const grace = Number(chance?.graceMinutes) || 0;
  if (dailyLimit <= 0) return null;

  const exhausted = chancesLeft <= 0;
  const lowAlert = !exhausted && chancesLeft === 1;
  const tone = exhausted
    ? 'border-l-rose-500 bg-rose-50/40'
    : lowAlert
      ? 'border-l-amber-500 bg-amber-50/40'
      : 'border-l-success bg-success/5';
  const icon = exhausted ? Flag : ShieldCheck;
  const Icon = icon;
  const iconTone = exhausted
    ? 'text-rose-700 bg-rose-100'
    : lowAlert
      ? 'text-amber-700 bg-amber-100'
      : 'text-emerald-700 bg-emerald-100';

  return (
    <Card className={`animate-fade-in-up border-l-4 ${tone}`}>
      <div className="flex items-start gap-3">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${iconTone}`}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text">
            {exhausted
              ? 'No free cancellations left today'
              : `${chancesLeft} of ${dailyLimit} free cancellation${
                  dailyLimit === 1 ? '' : 's'
                } left today`}
          </p>
          <p className="text-[11px] text-text-muted mt-0.5 leading-snug">
            {exhausted
              ? 'Cancelling now will deduct the configured penalty from your wallet. Counter resets at midnight.'
              : grace > 0
                ? `Cancel within ${grace} min of accepting to skip the penalty. ${
                    used > 0 ? `Used ${used} today.` : ''
                  }`
                : 'Cancellations may attract a penalty.'}
          </p>
        </div>
      </div>
    </Card>
  );
}

export default DriverHomePage;
