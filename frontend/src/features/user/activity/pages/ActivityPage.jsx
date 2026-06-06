import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import {
  MapPin,
  Clock,
  Calendar,
  Loader2,
  Navigation,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Car,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Badge from '../../../../components/Badge';
import OngoingTripCard, { pickOngoingBooking } from '../../../../components/OngoingTripCard';
import { useCachedQuery } from '../../../../hooks/useCachedQuery';
import { buildCacheKey } from '../../../../store/lib/buildCacheKey';
import { useUserBookingsStore } from '../../../../store/user/useUserBookingsStore';
import useUserActiveBookingStore from '../../../../store/user/useUserActiveBookingStore';
import { BOOKING_STATUS, ACTIVE_BOOKING_STATUSES } from '../../../../constants/bookingStatus';
import { SERVICE_CATALOG } from '../../home/constants/serviceCatalog';
import { useSocketEvent } from '../../../../hooks/useSocket';
import { S2C_EVENTS } from '../../../../constants/socketEvents';

/**
 * Map a booking row to the user-facing screen that owns its current
 * phase. Mirrors the status switch in `SearchingDriverPage` and the
 * tracking pages so the deep link feels seamless when the user taps a
 * "live" trip card.
 *
 * Returns `null` for terminal / non-active bookings — the driver side
 * does the same (completed + cancelled stay non-clickable today).
 */
const routeForBooking = (booking) => {
  if (!booking) return null;
  switch (booking.status) {
    case BOOKING_STATUS.PENDING_ASSIGNMENT:
    case BOOKING_STATUS.IN_EMERGENCY_POOL:
      return '/user/book/scheduled';
    case BOOKING_STATUS.SEARCHING:
      return '/user/book/searching';
    case BOOKING_STATUS.DRIVER_ASSIGNED:
      return '/user/book/assigned';
    case BOOKING_STATUS.AWAITING_PAYMENT:
      // Wallet bookings never see the standalone pay screen — bounce
      // them to the assigned screen where the inline pay sheet lives.
      return booking.paymentMethod === 'wallet'
        ? '/user/book/assigned'
        : '/user/book/payment';
    case BOOKING_STATUS.EN_ROUTE:
      return '/user/tracking/on-way';
    case BOOKING_STATUS.ARRIVED:
      return '/user/tracking/reached';
    case BOOKING_STATUS.STARTED:
      return '/user/tracking/in-progress';
    default:
      return null;
  }
};

const tabs = ['Active', 'Completed', 'Cancelled'];

const getStatusProps = (status) => {
  if (status === BOOKING_STATUS.COMPLETED) {
    return { label: 'Completed', variant: 'success', icon: CheckCircle2, bg: 'bg-emerald-50', border: 'border-emerald-100' };
  }
  if (status === BOOKING_STATUS.CANCELLED || status === BOOKING_STATUS.NO_DRIVERS_FOUND) {
    return { label: 'Cancelled', variant: 'danger', icon: AlertCircle, bg: 'bg-rose-50', border: 'border-rose-100' };
  }
  if ([BOOKING_STATUS.SEARCHING, BOOKING_STATUS.PENDING_ASSIGNMENT, BOOKING_STATUS.IN_EMERGENCY_POOL].includes(status)) {
    return { label: 'Searching', variant: 'warning', icon: Loader2, bg: 'bg-amber-50', border: 'border-amber-100' };
  }
  return { label: 'Active', variant: 'primary', icon: Navigation, bg: 'bg-indigo-50', border: 'border-indigo-100' };
};

const formatBookingDate = (b) => {
  const dateStr = b.hourly?.scheduledStartAt || b.outstation?.startDate || b.timeline?.createdAt || b.createdAt;
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const getDurationLabel = (b) => {
  if (b.hourly?.durationHours) return `${b.hourly.durationHours} hr${b.hourly.durationHours > 1 ? 's' : ''}`;
  if (b.outstation?.days) return `${b.outstation.days} day${b.outstation.days > 1 ? 's' : ''}`;
  return '';
};

const ActivityPage = () => {
  const navigate = useNavigate();
  const setActiveBooking = useUserActiveBookingStore((s) => s.setBooking);
  const activeBooking = useUserActiveBookingStore((s) => s.booking);
  const fetchActive = useUserActiveBookingStore((s) => s.fetchActive);
  const applyActiveUpdate = useUserActiveBookingStore((s) => s.applyUpdate);
  const clearActiveBooking = useUserActiveBookingStore((s) => s.clear);
  const [activeTab, setActiveTab] = useState('Active');

  const { data: bookings = [], loading, error, refetch } = useCachedQuery(
    useUserBookingsStore,
    buildCacheKey('user-bookings-history'),
  );

  // Force a fresh fetch on mount so we don't render a stale cached
  // status (the previous SearchingDriverPage left the cache at
  // SEARCHING). Both stores get refreshed in parallel.
  useEffect(() => {
    fetchActive().catch(() => {});
    refetch?.().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live socket → keep both stores in lockstep so the hero's phase
  // (and the list cards) reflect dispatcher events that fire while
  // the user is looking at this page (driver accept, payment, en
  // route, arrival, completion, cancellation, escalation, …).
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;
  useSocketEvent(
    S2C_EVENTS.BOOKING_UPDATED,
    useCallback(
      (payload) => {
        if (!payload) return;
        applyActiveUpdate(payload);
        // Clear the active-booking handle on terminal statuses so the
        // hero doesn't keep showing a finished trip.
        if (
          payload.status === BOOKING_STATUS.COMPLETED ||
          payload.status === BOOKING_STATUS.CANCELLED ||
          payload.status === BOOKING_STATUS.NO_DRIVERS_FOUND
        ) {
          clearActiveBooking();
        }
        refetchRef.current?.().catch(() => {});
      },
      [applyActiveUpdate, clearActiveBooking],
    ),
  );

  // Pick the freshest representation of the live booking. Both
  // sources can disagree by a tick — the active-booking store updates
  // over socket; the history list updates on refetch — so we always
  // prefer whichever has the *more advanced* lifecycle status when both
  // reference the same booking _id (logic lives in
  // `pickOngoingBooking`, shared with `/driver/trips`).
  const ongoingBooking = useMemo(
    () => pickOngoingBooking(activeBooking, bookings),
    [activeBooking, bookings],
  );
  const ongoingId = ongoingBooking ? String(ongoingBooking._id) : null;

  const filtered = useMemo(() => {
    return (bookings || []).filter((b) => {
      // Avoid showing the same trip both in the hero card and the list.
      if (ongoingId && String(b._id) === ongoingId) return false;
      if (activeTab === 'Completed') return b.status === BOOKING_STATUS.COMPLETED;
      if (activeTab === 'Cancelled') return b.status === BOOKING_STATUS.CANCELLED || b.status === BOOKING_STATUS.NO_DRIVERS_FOUND;
      return ACTIVE_BOOKING_STATUSES.includes(b.status);
    });
  }, [bookings, activeTab, ongoingId]);

  const handleCardClick = (booking) => {
    const route = routeForBooking(booking);
    if (!route) return;
    // Seed the active-booking store with what we already know so the
    // destination screen renders immediately. The tracking pages still
    // call `fetchActive` on mount, so any missing fields hydrate from
    // the canonical `/auth/bookings/active` endpoint a beat later.
    setActiveBooking(booking);
    navigate(route);
  };

  return (
    <div className="flex-1 flex flex-col bg-bg">
      <div className="sticky top-0 bg-white px-4 pt-5 pb-0 shadow-sm z-30">
        <h1 className="text-xl font-bold text-text mb-4">My Trips</h1>
        <div className="flex gap-1 overflow-x-auto pb-0 -mx-4 px-4 scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-semibold rounded-t-xl whitespace-nowrap transition-all duration-200
                ${
                  activeTab === tab
                    ? 'text-primary border-b-2 border-primary bg-primary/5'
                    : 'text-text-muted hover:text-text hover:bg-gray-50'
                }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 p-4 space-y-4 overflow-y-auto pb-20">
        {ongoingBooking && (
          <OngoingTripCard
            booking={ongoingBooking}
            audience="user"
            onOpen={() => handleCardClick(ongoingBooking)}
          />
        )}

        {loading && (!bookings || bookings.length === 0) ? (
          <div className="flex-1 flex items-center justify-center py-32">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20">
            <AlertCircle className="w-12 h-12 text-danger mb-3 opacity-50" />
            <p className="text-sm text-text-muted">Failed to load bookings</p>
            <button onClick={refetch} className="mt-3 text-sm text-primary font-medium">Try again</button>
          </div>
        ) : filtered.length === 0 ? (
          // If the active tab is empty BUT the ongoing-trip hero is
          // already covering the user's live booking, suppress the
          // generic "no trips" state — it would read like a
          // contradiction right under the hero.
          activeTab === 'Active' && ongoingBooking ? null : (
            <div className="flex-1 flex flex-col items-center justify-center py-32 text-center animate-fade-in-up">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Car className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-base font-bold text-text mb-1">No {activeTab.toLowerCase()} trips</h3>
              <p className="text-sm text-text-muted max-w-[240px]">
                {activeTab === 'Active'
                  ? "You don't have any ongoing trips at the moment."
                  : `You haven't ${activeTab.toLowerCase()} any trips yet.`}
              </p>
            </div>
          )
        ) : (
          filtered.map((booking, idx) => {
            const { label, variant, icon: StatusIcon, bg, border } = getStatusProps(booking.status);
            const catalog = SERVICE_CATALOG[booking.serviceType] || {};
            const serviceName = catalog.title || booking.serviceType;
            const fare = booking.fareSnapshot?.total || booking.payment?.amountPaidRupees || 0;
            const isHourly = booking.serviceType === 'hourly';
            const clickRoute = routeForBooking(booking);
            const isClickable = !!clickRoute;

            return (
              <div
                key={booking._id}
                onClick={isClickable ? () => handleCardClick(booking) : undefined}
                role={isClickable ? 'button' : undefined}
                tabIndex={isClickable ? 0 : undefined}
                onKeyDown={
                  isClickable
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleCardClick(booking);
                        }
                      }
                    : undefined
                }
                className={`relative overflow-hidden rounded-2xl bg-white border ${border} shadow-sm transition-all duration-200 animate-fade-in-up ${
                  isClickable
                    ? 'cursor-pointer hover:shadow-md hover:border-primary/20 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40'
                    : ''
                }`}
                style={{ animationDelay: `${idx * 0.05}s` }}
              >
                {/* Accent top border */}
                <div className={`h-1.5 w-full ${catalog.gradient || 'bg-gradient-to-r from-gray-200 to-gray-300'}`} />

                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${bg}`}>
                        <StatusIcon className={`w-4 h-4 ${variant === 'primary' ? 'text-indigo-600' : variant === 'success' ? 'text-emerald-600' : variant === 'danger' ? 'text-rose-600' : 'text-amber-600'} ${booking.status === BOOKING_STATUS.SEARCHING ? 'animate-spin' : ''}`} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-text capitalize">{serviceName}</h3>
                        <p className="text-[11px] font-mono text-text-muted mt-0.5">#{booking.bookingNumber || booking._id.slice(-6).toUpperCase()}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <div className="flex flex-col items-end">
                        <span className="text-sm font-bold text-text">{`\u20B9`}{fare}</span>
                        <Badge variant={variant} className="mt-1 scale-90 origin-right">{label}</Badge>
                      </div>
                      {isClickable && (
                        <ChevronRight className="w-4 h-4 text-text-muted shrink-0 mt-0.5" />
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 mt-4 pl-1">
                    <div className="flex items-start gap-3 text-sm text-text-secondary">
                      <div className="mt-0.5">
                        <MapPin className="w-4 h-4 text-primary" />
                      </div>
                      <span className="flex-1 line-clamp-1">{booking.pickup?.address || 'Pickup location'}</span>
                    </div>

                    {!isHourly && booking.dropoff && (
                      <div className="flex items-start gap-3 text-sm text-text-secondary relative">
                        <div className="absolute left-2 -top-3 w-px h-3 bg-gray-200" />
                        <div className="mt-0.5">
                          <MapPin className="w-4 h-4 text-rose-500" />
                        </div>
                        <span className="flex-1 line-clamp-1">{booking.dropoff.address}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-3 text-xs text-text-muted mt-3">
                      <Calendar className="w-3.5 h-3.5 shrink-0" />
                      <span>{formatBookingDate(booking)}</span>
                      <span className="w-1 h-1 rounded-full bg-gray-300" />
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      <span>{getDurationLabel(booking)}</span>
                    </div>
                  </div>

                  {booking.driverId && (
                    <div className="mt-4 pt-3 border-t border-border-light flex items-center justify-between bg-gray-50/50 -mx-4 -mb-4 px-4 pb-4">
                      <div className="flex items-center gap-2">
                        <img
                          src={booking.driverId.profilePicture || 'https://ui-avatars.com/api/?name=' + (booking.driverId.name || 'Driver')}
                          alt="Driver"
                          className="w-7 h-7 rounded-full bg-gray-200 object-cover"
                        />
                        <span className="text-xs font-medium text-text-secondary">{booking.driverId.name || 'Your Driver'}</span>
                      </div>
                      {booking.driverId.rating && (
                        <span className="text-xs font-bold text-amber-500 bg-amber-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                          ⭐ {booking.driverId.rating}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ActivityPage;
