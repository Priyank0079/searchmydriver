import { useEffect } from 'react';
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
            onResume={() => navigate(`/driver/trip/${activeBooking._id}`)}
          />
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
 * Compact "resume your trip" tile shown on home whenever the driver has a
 * booking in any active status. Tapping anywhere on the card jumps back
 * to the live trip page so the driver can never lose context after closing
 * the app or switching tabs.
 */
function ActiveTripCard({ booking, onResume }) {
  const status = booking?.status;
  const subtitle =
    ACTIVE_STATUS_COPY[status] || 'Trip in progress';
  const fare = booking?.fareSnapshot?.total;
  const serviceLabel =
    SERVICE_TYPE_LABELS[booking?.serviceType] || booking?.serviceType || 'Trip';
  const pickup = booking?.pickup?.address;
  const hours =
    booking?.serviceType === SERVICE_TYPES.HOURLY
      ? booking?.hourly?.durationHours
      : null;

  return (
    <Card
      hoverable
      onClick={onResume}
      className="animate-fade-in-up border-l-4 border-l-primary"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Badge variant="primary">{serviceLabel}</Badge>
          {hours && (
            <span className="text-[11px] text-text-muted">{hours} h booked</span>
          )}
        </div>
        {fare > 0 && (
          <span className="text-sm font-bold text-text">{formatCurrency(fare)}</span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
          <Car className="w-5 h-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text truncate">{subtitle}</p>
          {pickup && (
            <p className="text-xs text-text-muted truncate mt-0.5">{pickup}</p>
          )}
        </div>
        <ChevronRight className="w-4 h-4 text-text-muted shrink-0" />
      </div>
    </Card>
  );
}

export default DriverHomePage;
