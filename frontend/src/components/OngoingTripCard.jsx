import {
  AlertCircle,
  CalendarClock,
  Car,
  ChevronRight,
  LifeBuoy,
  Loader2,
  MapPin,
  Navigation,
} from 'lucide-react';
import {
  BOOKING_STATUS,
  ACTIVE_BOOKING_STATUSES,
} from '../constants/bookingStatus';
import { SERVICE_TYPE_LABELS } from '../constants/serviceTypes';

/**
 * Shared "Ongoing trip" hero card used by `/user/activity` and
 * `/driver/trips`. Same visual treatment on both sides — only the
 * person footer adapts to the audience:
 *
 *   audience='user'   → shows the assigned driver (avatar + rating)
 *   audience='driver' → shows the customer (avatar + masked phone)
 *
 * All other elements (phase headline, CTA, pulse, pickup line, color)
 * are identical so the active-trip surface reads the same to both
 * sides of the marketplace.
 */

const PHASE_BY_STATUS = {
  [BOOKING_STATUS.PENDING_ASSIGNMENT]: {
    headline: 'Scheduled trip waiting',
    cta: 'View',
    Icon: CalendarClock,
    pulse: false,
  },
  [BOOKING_STATUS.IN_EMERGENCY_POOL]: {
    headline: 'Admin is finding a driver',
    cta: 'View',
    Icon: LifeBuoy,
    pulse: true,
  },
  [BOOKING_STATUS.SEARCHING]: {
    headline: 'Searching for a driver',
    cta: 'Track',
    Icon: Loader2,
    pulse: true,
  },
  [BOOKING_STATUS.DRIVER_ASSIGNED]: {
    headline: 'Driver assigned',
    cta: 'Open',
    Icon: Navigation,
    pulse: false,
  },
  [BOOKING_STATUS.AWAITING_PAYMENT]: {
    headline: 'Payment needed',
    cta: 'Pay now',
    Icon: AlertCircle,
    pulse: true,
  },
  [BOOKING_STATUS.EN_ROUTE]: {
    headline: 'Driver is on the way',
    cta: 'Track',
    Icon: Navigation,
    pulse: true,
  },
  [BOOKING_STATUS.ARRIVED]: {
    headline: 'Driver has arrived',
    cta: 'Open',
    Icon: Car,
    pulse: true,
  },
  [BOOKING_STATUS.STARTED]: {
    headline: 'Trip in progress',
    cta: 'Open',
    Icon: Navigation,
    pulse: true,
  },
};

const SPINNING_STATUSES = new Set([
  BOOKING_STATUS.SEARCHING,
  BOOKING_STATUS.PENDING_ASSIGNMENT,
  BOOKING_STATUS.IN_EMERGENCY_POOL,
]);

/**
 * Re-shape the driver-side CTA copy so the verb fits the driver's
 * vantage point (they're not "tracking" their own ride — they're
 * doing it).
 */
const DRIVER_CTA_OVERRIDES = {
  [BOOKING_STATUS.DRIVER_ASSIGNED]: { headline: 'New trip assigned', cta: 'Start' },
  [BOOKING_STATUS.AWAITING_PAYMENT]: { headline: 'Waiting on customer payment', cta: 'Open' },
  [BOOKING_STATUS.EN_ROUTE]: { headline: 'Heading to pickup', cta: 'Open' },
  [BOOKING_STATUS.ARRIVED]: { headline: 'At pickup', cta: 'Open' },
  [BOOKING_STATUS.STARTED]: { headline: 'Trip in progress', cta: 'Open' },
};

function maskPhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length < 4) return digits || '';
  return `\u2022\u2022\u2022\u2022 ${digits.slice(-4)}`;
}

function formatPickupSummary(booking) {
  if (!booking) return '';
  const iso =
    booking?.hourly?.scheduledStartAt ||
    booking?.outstation?.startDate ||
    booking?.timeline?.driverAssignedAt ||
    booking?.timeline?.createdAt ||
    booking?.createdAt;
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const PersonRow = ({ booking, audience }) => {
  const isDriver = audience === 'driver';
  const person = isDriver
    ? typeof booking?.userId === 'object'
      ? booking.userId
      : null
    : typeof booking?.driverId === 'object'
      ? booking.driverId
      : null;
  if (!person) return null;

  const fallbackName = isDriver ? 'Customer' : 'Your driver';
  const name = person.name || fallbackName;
  const avatar =
    person.profilePicture ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      name,
    )}&background=ffffff&color=4f46e5`;

  return (
    <div className="mt-2 flex items-center justify-between text-[11px] text-white/90">
      <div className="flex items-center gap-2 min-w-0">
        <img
          src={avatar}
          alt={isDriver ? 'Customer' : 'Driver'}
          className="w-6 h-6 rounded-full bg-white/20 object-cover shrink-0"
        />
        <span className="font-medium truncate">{name}</span>
      </div>
      {isDriver
        ? person.phone_no && (
            <span className="font-mono text-white/80 shrink-0">
              {maskPhone(person.phone_no)}
            </span>
          )
        : person.rating && (
            <span className="font-semibold shrink-0">
              {'\u2B50 '}
              {person.rating}
            </span>
          )}
    </div>
  );
};

const OngoingTripCard = ({ booking, onOpen, audience = 'user', className = '' }) => {
  if (!booking) return null;

  const basePhase =
    PHASE_BY_STATUS[booking.status] || {
      headline: 'Active trip',
      cta: 'Open',
      Icon: Car,
      pulse: false,
    };
  const override =
    audience === 'driver' ? DRIVER_CTA_OVERRIDES[booking.status] : null;
  const phase = { ...basePhase, ...(override || {}) };
  const PhaseIcon = phase.Icon;
  const serviceLabel =
    SERVICE_TYPE_LABELS[booking.serviceType] || booking.serviceType || 'Trip';
  const pickupSummary = formatPickupSummary(booking);
  const spinning = SPINNING_STATUSES.has(booking.status);

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`relative w-full overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-indigo-600 text-white text-left shadow-lg shadow-primary/20 transition-all duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 animate-fade-in-up ${className}`}
    >
      <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-white/10 blur-2xl pointer-events-none" />

      <div className="relative p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/15 text-[10px] font-bold uppercase tracking-wide">
            {phase.pulse && (
              <span className="relative flex w-1.5 h-1.5">
                <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-300 opacity-75 animate-ping" />
                <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-emerald-300" />
              </span>
            )}
            Ongoing
          </span>
          <span className="text-[10px] font-mono text-white/70">
            #{booking.bookingNumber || String(booking._id).slice(-6).toUpperCase()}
          </span>
        </div>

        <div className="mt-3 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
            <PhaseIcon className={`w-5 h-5 ${spinning ? 'animate-spin' : ''}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold leading-tight">{phase.headline}</h2>
            <p className="text-xs text-white/80 mt-0.5 capitalize">
              {serviceLabel}
              {pickupSummary ? ` \u00b7 ${pickupSummary}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-1 text-xs font-semibold bg-white/15 px-2.5 py-1 rounded-full">
            {phase.cta}
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-white/10 flex items-start gap-2 text-xs text-white/85">
          <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span className="line-clamp-1">
            {booking.pickup?.address || 'Pickup location'}
          </span>
        </div>

        <PersonRow booking={booking} audience={audience} />
      </div>
    </button>
  );
};

/**
 * Helper that picks the freshest representation of the live booking
 * given two possibly-disagreeing sources (an "active booking" store
 * updated over socket, and a periodically-refetched history list).
 *
 * Both pages — `/user/activity` and `/driver/trips` — call this so the
 * hero never lags behind a known transition. When both sources refer
 * to the same booking _id we pick whichever has the further-along
 * lifecycle phase (`ACTIVE_BOOKING_STATUSES` is ordered by
 * progression). Otherwise we prefer the store value (it's the one
 * that gets live socket patches) and fall back to the list.
 */
export function pickOngoingBooking(activeBooking, listBookings) {
  const listLive = (listBookings || []).find((b) =>
    ACTIVE_BOOKING_STATUSES.includes(b.status),
  );
  const storeLive =
    activeBooking && ACTIVE_BOOKING_STATUSES.includes(activeBooking.status)
      ? activeBooking
      : null;
  if (storeLive && listLive && String(storeLive._id) === String(listLive._id)) {
    const storeRank = ACTIVE_BOOKING_STATUSES.indexOf(storeLive.status);
    const listRank = ACTIVE_BOOKING_STATUSES.indexOf(listLive.status);
    return storeRank >= listRank ? storeLive : listLive;
  }
  return storeLive || listLive || null;
}

export default OngoingTripCard;
