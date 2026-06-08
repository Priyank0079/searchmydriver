import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Car as CarIcon,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  Navigation,
  Phone,
  ReceiptText,
  ShieldCheck,
  Star,
  Wallet as WalletIcon,
  XCircle,
} from 'lucide-react';
import api from '../../../../utils/api';
import Card from '../../../../components/Card';
import Button from '../../../../components/Button';
import Avatar from '../../../../components/Avatar';
import Badge from '../../../../components/Badge';
import {
  ACTIVE_BOOKING_STATUSES,
  BOOKING_STATUS,
} from '../../../../constants/bookingStatus';
import { SERVICE_TYPES, SERVICE_TYPE_LABELS } from '../../../../constants/serviceTypes';
import { SERVICE_CATALOG } from '../../home/constants/serviceCatalog';
import { useSocket, useSocketEvent } from '../../../../hooks/useSocket';
import { C2S_EVENTS, S2C_EVENTS } from '../../../../constants/socketEvents';
import useUserActiveBookingStore from '../../../../store/user/useUserActiveBookingStore';

/**
 * Per-booking detail screen, reachable from any card on /user/activity.
 *
 * Fetches the booking by id (so the page always shows *that* booking
 * even if a different one is currently active) and renders a consistent
 * read-only summary across every status:
 *   - hero header with status pill
 *   - trip details (service, datetime, duration, route)
 *   - driver block (name, photo, rating, call CTA)
 *   - fare breakdown (base + waiting + extensions + GST = total, with the
 *     payment ledger so the user can see what's been paid vs. outstanding)
 *   - status-specific footer (continue tracking for live trips, rate +
 *     invoice for completed, cancellation reason + refund for cancelled)
 */
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const formatRupees = (amount) =>
  `\u20B9${Number(amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDateTime = (value) => {
  if (!value) return '';
  return new Date(value).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDuration = (booking) => {
  if (booking?.hourly?.durationHours) {
    const h = booking.hourly.durationHours;
    return `${h} hour${h > 1 ? 's' : ''}`;
  }
  if (booking?.outstation?.days) {
    const d = booking.outstation.days;
    return `${d} day${d > 1 ? 's' : ''}`;
  }
  return null;
};

const STATUS_STYLES = {
  [BOOKING_STATUS.COMPLETED]: {
    label: 'Completed',
    icon: CheckCircle2,
    pill: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    hero: 'from-emerald-500 to-emerald-700',
  },
  [BOOKING_STATUS.CANCELLED]: {
    label: 'Cancelled',
    icon: XCircle,
    pill: 'bg-rose-100 text-rose-700 border-rose-200',
    hero: 'from-rose-500 to-rose-700',
  },
  [BOOKING_STATUS.NO_DRIVERS_FOUND]: {
    label: 'No drivers found',
    icon: AlertCircle,
    pill: 'bg-rose-100 text-rose-700 border-rose-200',
    hero: 'from-rose-500 to-rose-700',
  },
  [BOOKING_STATUS.SEARCHING]: {
    label: 'Searching driver',
    icon: Loader2,
    pill: 'bg-amber-100 text-amber-700 border-amber-200',
    hero: 'from-amber-500 to-amber-700',
  },
  [BOOKING_STATUS.PENDING_ASSIGNMENT]: {
    label: 'Scheduled',
    icon: Calendar,
    pill: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    hero: 'from-indigo-500 to-indigo-700',
  },
  [BOOKING_STATUS.IN_EMERGENCY_POOL]: {
    label: 'Manual queue',
    icon: AlertCircle,
    pill: 'bg-amber-100 text-amber-700 border-amber-200',
    hero: 'from-amber-500 to-amber-700',
  },
  [BOOKING_STATUS.AWAITING_PAYMENT]: {
    label: 'Awaiting payment',
    icon: WalletIcon,
    pill: 'bg-amber-100 text-amber-700 border-amber-200',
    hero: 'from-amber-500 to-amber-700',
  },
  [BOOKING_STATUS.DRIVER_ASSIGNED]: {
    label: 'Driver assigned',
    icon: Navigation,
    pill: 'bg-sky-100 text-sky-700 border-sky-200',
    hero: 'from-sky-500 to-sky-700',
  },
  [BOOKING_STATUS.EN_ROUTE]: {
    label: 'Driver on the way',
    icon: Navigation,
    pill: 'bg-sky-100 text-sky-700 border-sky-200',
    hero: 'from-sky-500 to-sky-700',
  },
  [BOOKING_STATUS.ARRIVED]: {
    label: 'Driver arrived',
    icon: MapPin,
    pill: 'bg-sky-100 text-sky-700 border-sky-200',
    hero: 'from-sky-500 to-sky-700',
  },
  [BOOKING_STATUS.STARTED]: {
    label: 'Trip in progress',
    icon: Navigation,
    pill: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    hero: 'from-indigo-500 to-indigo-700',
  },
};

const FALLBACK_STATUS_STYLE = {
  label: 'Booking',
  icon: ReceiptText,
  pill: 'bg-gray-100 text-gray-700 border-gray-200',
  hero: 'from-slate-500 to-slate-700',
};

/**
 * Route that owns the live UX for an active booking status. Id-scoped
 * paths (e.g. `/user/book/assigned/:id`) are used wherever the page
 * supports them so a hard refresh keeps the user on the same
 * booking — falling back to the generic `/active` endpoint would
 * surface the wrong trip when the user has multiple active bookings.
 */
const liveRouteForStatus = (status, bookingId) => {
  switch (status) {
    case BOOKING_STATUS.PENDING_ASSIGNMENT:
    case BOOKING_STATUS.IN_EMERGENCY_POOL:
      return '/user/book/scheduled';
    case BOOKING_STATUS.SEARCHING:
      return '/user/book/searching';
    case BOOKING_STATUS.AWAITING_PAYMENT:
    case BOOKING_STATUS.DRIVER_ASSIGNED:
    case BOOKING_STATUS.ARRIVED:
    // Trip-in-progress also routes to the assigned page so the user
    // stays on the same "one canvas with the live map" surface for
    // the whole post-acceptance lifecycle instead of bouncing into
    // the standalone `/user/tracking/in-progress` screen.
    case BOOKING_STATUS.STARTED:
      return bookingId
        ? `/user/book/assigned/${bookingId}`
        : '/user/book/assigned';
    case BOOKING_STATUS.EN_ROUTE:
      return '/user/tracking/on-way';
    default:
      return null;
  }
};

const TripDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { emit, isConnected } = useSocket();
  const setActiveBooking = useUserActiveBookingStore((s) => s.setBooking);

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchBooking = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const res = await api.get(`/auth/bookings/${id}`);
      const data = res?.data?.data?.booking || null;
      setBooking(data);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          'Could not load this trip',
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    fetchBooking();
  }, [fetchBooking]);

  // Live refresh for active bookings — anyone watching this detail
  // page benefits from the same socket stream the live tracking pages
  // use. Joins the booking room so emits scoped to the room land too.
  useEffect(() => {
    const bookingId = booking?._id;
    if (!bookingId || !isConnected) return undefined;
    if (!ACTIVE_BOOKING_STATUSES.includes(booking.status)) return undefined;
    emit(C2S_EVENTS.BOOKING_JOIN, { bookingId });
    return () => emit(C2S_EVENTS.BOOKING_LEAVE, { bookingId });
  }, [booking?._id, booking?.status, isConnected, emit]);

  useSocketEvent(S2C_EVENTS.BOOKING_UPDATED, (payload) => {
    if (!payload?.bookingId) return;
    if (!booking?._id || String(payload.bookingId) !== String(booking._id)) return;
    // Re-pull the canonical record rather than try to merge a partial
    // patch — keeps this page's render math simple and correct.
    fetchBooking();
  });

  const status = booking?.status;
  const statusStyle = STATUS_STYLES[status] || FALLBACK_STATUS_STYLE;
  const StatusIcon = statusStyle.icon;
  const isLive = status && ACTIVE_BOOKING_STATUSES.includes(status);
  const liveRoute = liveRouteForStatus(status, booking?._id);

  const driverPhotoUrl = useMemo(() => {
    const driver = booking?.driverId;
    if (!driver) return null;
    const docs = Array.isArray(driver.documents) ? driver.documents : [];
    const selfie = docs.find((d) => d?.type === 'selfie' && d?.fileUrl);
    return selfie?.fileUrl || driver.profilePicture || null;
  }, [booking?.driverId]);

  const driver = booking?.driverId && typeof booking.driverId === 'object'
    ? booking.driverId
    : null;
  const driverCallHref = driver?.phone_no
    ? `tel:${String(driver.phone_no).replace(/[^+\d]/g, '')}`
    : null;

  const fareBreakdown = booking?.fareSnapshot?.breakdown || {};
  const baseTotal = Number(booking?.fareSnapshot?.total || 0);
  const waitingCharge = Number(booking?.waiting?.chargeRupees || 0);
  const extensions = Array.isArray(booking?.extensions) ? booking.extensions : [];
  const acceptedExtensions = extensions.filter((ext) => ext?.status === 'accepted');
  const extensionTotal = acceptedExtensions.reduce(
    (sum, ext) => sum + (Number(ext?.fareDelta) || 0),
    0,
  );
  const effectiveTotal = round2(baseTotal + waitingCharge + extensionTotal);
  const amountPaid = Number(booking?.payment?.amountPaidRupees || 0);
  const amountDue = Math.max(0, round2(effectiveTotal - amountPaid));

  const serviceLabel =
    SERVICE_TYPE_LABELS[booking?.serviceType] || booking?.serviceType || 'Trip';
  const catalogTitle = SERVICE_CATALOG[booking?.serviceType]?.title || serviceLabel;

  const scheduledAt =
    booking?.hourly?.scheduledStartAt ||
    booking?.outstation?.startDate ||
    booking?.timeline?.scheduledFor ||
    null;
  const createdAt = booking?.createdAt || booking?.timeline?.createdAt;
  const completedAt = booking?.timeline?.completedAt;
  const cancelledAt = booking?.timeline?.cancelledAt;
  const startedAt = booking?.timeline?.startedAt;

  const handleContinueTracking = () => {
    if (!booking || !liveRoute) return;
    // Live pages call `fetchActive` on mount — seeding the store first
    // means the right booking renders without a flash.
    setActiveBooking(booking);
    navigate(liveRoute);
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col bg-bg min-h-dvh items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="flex-1 flex flex-col bg-bg min-h-dvh">
        <PageHeader onBack={() => navigate(-1)} title="Trip details" />
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <AlertCircle className="w-12 h-12 text-rose-500 mb-3" />
          <p className="text-sm text-text font-medium">{error || 'Trip not found'}</p>
          <Button variant="ghost" onClick={fetchBooking} className="mt-3">
            Try again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-bg min-h-dvh">
      <PageHeader onBack={() => navigate(-1)} title="Trip details" />

      {/* Hero — status + booking id + total */}
      <div
        className={`bg-gradient-to-br ${statusStyle.hero} text-white px-4 pt-4 pb-6`}
      >
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 text-[11px] font-semibold tracking-wide">
            <StatusIcon
              className={`w-3.5 h-3.5 ${
                status === BOOKING_STATUS.SEARCHING ? 'animate-spin' : ''
              }`}
            />
            {statusStyle.label}
          </span>
          <span className="text-[11px] font-mono text-white/80">
            #{booking.bookingNumber || String(booking._id).slice(-6).toUpperCase()}
          </span>
        </div>
        <h1 className="mt-3 text-2xl font-bold">{catalogTitle}</h1>
        <p className="text-xs text-white/80 mt-0.5">
          {scheduledAt
            ? `Scheduled ${formatDateTime(scheduledAt)}`
            : createdAt
              ? `Booked ${formatDateTime(createdAt)}`
              : ''}
        </p>
        <div className="mt-4 flex items-end justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-white/70">
              Trip total
            </p>
            <p className="text-2xl font-bold">{formatRupees(effectiveTotal)}</p>
          </div>
          {amountDue > 0 && (
            <span className="px-3 py-1 rounded-full bg-rose-500/30 border border-white/30 text-[11px] font-semibold">
              {formatRupees(amountDue)} due
            </span>
          )}
          {amountDue <= 0 && amountPaid > 0 && (
            <span className="px-3 py-1 rounded-full bg-white/15 border border-white/30 text-[11px] font-semibold">
              Paid
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 px-4 -mt-3 pb-28 space-y-3">
        <TripRouteCard
          booking={booking}
          serviceLabel={serviceLabel}
          startedAt={startedAt}
          completedAt={completedAt}
        />

        {driver && (
          <DriverCard
            name={driver.name}
            photo={driverPhotoUrl}
            phone={driver.phone_no}
            callHref={driverCallHref}
            rating={driver.rating}
            experienceYears={driver.experienceYears}
          />
        )}

        <FareCard
          baseTotal={baseTotal}
          breakdown={fareBreakdown}
          waiting={booking.waiting}
          extensions={acceptedExtensions}
          effectiveTotal={effectiveTotal}
          amountPaid={amountPaid}
          amountDue={amountDue}
          paymentMethod={booking.paymentMethod}
          paymentStatus={booking.paymentStatus}
        />

        {booking.status === BOOKING_STATUS.CANCELLED && booking.cancellation && (
          <CancellationCard
            cancellation={booking.cancellation}
            refund={booking.refund}
            cancelledAt={cancelledAt}
          />
        )}

        {booking.status === BOOKING_STATUS.NO_DRIVERS_FOUND && (
          <Card className="bg-rose-50 border border-rose-100">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-rose-900">
                  No drivers were available
                </p>
                <p className="text-xs text-rose-800 mt-0.5">
                  Your booking was closed without anyone being dispatched. Any
                  amount you paid has been refunded to your wallet.
                </p>
              </div>
            </div>
          </Card>
        )}

        <Card>
          <p className="text-[11px] uppercase tracking-wide text-text-muted font-semibold mb-2">
            Booking ledger
          </p>
          <LedgerRow label="Booked" value={formatDateTime(createdAt)} />
          {scheduledAt && (
            <LedgerRow label="Scheduled for" value={formatDateTime(scheduledAt)} />
          )}
          {startedAt && (
            <LedgerRow label="Started" value={formatDateTime(startedAt)} />
          )}
          {completedAt && (
            <LedgerRow label="Completed" value={formatDateTime(completedAt)} />
          )}
          {cancelledAt && (
            <LedgerRow label="Cancelled" value={formatDateTime(cancelledAt)} />
          )}
        </Card>
      </div>

      {/* Sticky footer actions */}
      <div className="sticky bottom-0 bg-white border-t border-border-light px-4 py-3 z-10">
        {isLive && liveRoute ? (
          <Button fullWidth onClick={handleContinueTracking} icon={Navigation}>
            Continue tracking
          </Button>
        ) : booking.status === BOOKING_STATUS.COMPLETED ? (
          <Button
            fullWidth
            variant="primary"
            onClick={() => navigate('/user/book/service')}
            icon={CarIcon}
          >
            Book again
          </Button>
        ) : (
          <Button fullWidth variant="ghost" onClick={() => navigate(-1)}>
            Back to my trips
          </Button>
        )}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

function PageHeader({ onBack, title }) {
  return (
    <div className="sticky top-0 bg-white px-4 py-3 shadow-sm z-30 flex items-center gap-2">
      <button
        type="button"
        onClick={onBack}
        className="p-2 -ml-2 rounded-xl hover:bg-gray-100"
        aria-label="Back"
      >
        <ArrowLeft className="w-5 h-5 text-text" />
      </button>
      <h1 className="text-base font-bold text-text">{title}</h1>
    </div>
  );
}

function TripRouteCard({ booking, serviceLabel, startedAt, completedAt }) {
  const isHourly = booking.serviceType === SERVICE_TYPES.HOURLY;
  const durationLabel = formatDuration(booking);
  const pickup = booking.pickup?.address;
  const dropoff = booking.dropoff?.address;
  const distance = booking.fareSnapshot?.breakdown?.distanceKm;

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text">Trip route</h3>
        <span className="text-[11px] font-semibold uppercase tracking-wide bg-primary/10 text-primary-dark px-2 py-0.5 rounded-full">
          {serviceLabel}
        </span>
      </div>

      <div className="relative pl-7">
        <div className="absolute left-2 top-2 bottom-2 w-px bg-border" />

        <div className="relative mb-3">
          <span className="absolute -left-7 top-1 inline-flex w-4 h-4 items-center justify-center">
            <span className="w-2.5 h-2.5 rounded-full bg-primary" />
          </span>
          <p className="text-[11px] uppercase tracking-wide text-text-muted font-semibold">
            Pickup
          </p>
          <p className="text-sm text-text leading-snug">
            {pickup || 'Pickup location'}
          </p>
        </div>

        {dropoff ? (
          <div className="relative">
            <span className="absolute -left-7 top-1 inline-flex w-4 h-4 items-center justify-center">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            </span>
            <p className="text-[11px] uppercase tracking-wide text-text-muted font-semibold">
              Destination
            </p>
            <p className="text-sm text-text leading-snug">{dropoff}</p>
          </div>
        ) : (
          <div className="relative">
            <span className="absolute -left-7 top-1 inline-flex w-4 h-4 items-center justify-center">
              <span className="w-2.5 h-2.5 rounded-full border-2 border-primary bg-white" />
            </span>
            <p className="text-[11px] uppercase tracking-wide text-text-muted font-semibold">
              {isHourly ? 'Around the city' : 'Multi-day trip'}
            </p>
            <p className="text-sm text-text leading-snug">
              Driver stays with you for the booked duration.
            </p>
          </div>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-border-light grid grid-cols-2 gap-3 text-xs">
        {durationLabel && (
          <DetailTile icon={Clock} label="Duration" value={durationLabel} />
        )}
        {distance ? (
          <DetailTile icon={Navigation} label="Distance" value={`${distance} km`} />
        ) : null}
        {startedAt && (
          <DetailTile icon={Calendar} label="Started" value={formatDateTime(startedAt)} />
        )}
        {completedAt && (
          <DetailTile
            icon={CheckCircle2}
            label="Completed"
            value={formatDateTime(completedAt)}
          />
        )}
      </div>
    </Card>
  );
}

function DetailTile({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-3.5 h-3.5 mt-0.5 text-text-muted shrink-0" />
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-text-muted">
          {label}
        </p>
        <p className="text-sm text-text font-medium truncate">{value}</p>
      </div>
    </div>
  );
}

function DriverCard({ name, photo, phone, callHref, rating, experienceYears }) {
  return (
    <Card>
      <p className="text-[11px] uppercase tracking-wide text-text-muted font-semibold mb-3">
        Driver
      </p>
      <div className="flex items-center gap-3">
        <Avatar src={photo} name={name || 'Driver'} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold text-text truncate">
              {name || 'Your driver'}
            </p>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5">
            {rating ? (
              <span className="inline-flex items-center gap-0.5 text-amber-600 font-medium">
                <Star className="w-3 h-3 fill-amber-500 stroke-amber-500" />
                {Number(rating).toFixed(1)}
              </span>
            ) : null}
            {experienceYears ? (
              <span className="truncate">{experienceYears}+ yrs experience</span>
            ) : null}
            {phone && (
              <span className="truncate">{phone}</span>
            )}
          </div>
        </div>
        {callHref && (
          <a
            href={callHref}
            className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm hover:bg-emerald-600 transition-colors"
            aria-label={`Call ${name || 'driver'}`}
          >
            <Phone className="w-4 h-4" />
          </a>
        )}
      </div>
    </Card>
  );
}

function FareCard({
  baseTotal,
  breakdown,
  waiting,
  extensions,
  effectiveTotal,
  amountPaid,
  amountDue,
  paymentMethod,
  paymentStatus,
}) {
  const lines = [];
  if (baseTotal > 0) {
    lines.push({ label: 'Base fare', value: baseTotal });
  }
  const serviceCharge = Number(breakdown?.serviceCharge) || 0;
  if (serviceCharge > 0) {
    lines.push({ label: 'Service charge', value: serviceCharge, muted: true });
  }
  const gst = Number(breakdown?.gst) || 0;
  if (gst > 0) {
    lines.push({ label: 'GST', value: gst, muted: true });
  }
  if (waiting?.chargeRupees > 0) {
    lines.push({
      label: `Waiting (${waiting.billableMinutes || 0} min)`,
      value: waiting.chargeRupees,
      pillNote: waiting.noShow ? 'No-show' : null,
    });
  }
  extensions.forEach((ext, idx) => {
    lines.push({
      label: `Extension ${extensions.length > 1 ? idx + 1 : ''} (+${ext.additionalHours}h)`,
      value: ext.fareDelta,
    });
  });

  return (
    <Card>
      <p className="text-[11px] uppercase tracking-wide text-text-muted font-semibold mb-3">
        Fare breakdown
      </p>
      <div className="space-y-1.5">
        {lines.length === 0 ? (
          <div className="text-sm text-text-muted">No charges recorded</div>
        ) : (
          lines.map((line, idx) => (
            <div
              key={`${line.label}-${idx}`}
              className="flex items-center justify-between gap-3"
            >
              <span
                className={`text-sm ${line.muted ? 'text-text-muted' : 'text-text'}`}
              >
                {line.label}
                {line.pillNote && (
                  <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-full">
                    {line.pillNote}
                  </span>
                )}
              </span>
              <span
                className={`text-sm tabular-nums ${
                  line.muted ? 'text-text-muted' : 'text-text font-medium'
                }`}
              >
                {formatRupees(line.value)}
              </span>
            </div>
          ))
        )}

        <div className="mt-3 pt-3 border-t border-border-light flex items-center justify-between">
          <span className="text-sm font-semibold text-text">Total</span>
          <span className="text-base font-bold text-text tabular-nums">
            {formatRupees(effectiveTotal)}
          </span>
        </div>

        <div className="mt-1 flex items-center justify-between text-xs">
          <span className="text-text-muted">Paid so far</span>
          <span className="text-text font-medium tabular-nums">
            {formatRupees(amountPaid)}
          </span>
        </div>
        {amountDue > 0 && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-rose-700 font-medium">Outstanding</span>
            <span className="text-rose-700 font-semibold tabular-nums">
              {formatRupees(amountDue)}
            </span>
          </div>
        )}
      </div>

      {(paymentMethod || paymentStatus) && (
        <div className="mt-3 pt-3 border-t border-border-light flex items-center justify-between text-xs">
          <span className="text-text-muted">
            Paid via{' '}
            <span className="text-text font-medium capitalize">
              {paymentMethod || '—'}
            </span>
          </span>
          {paymentStatus && (
            <Badge variant={paymentStatus === 'paid' ? 'success' : 'warning'}>
              {paymentStatus}
            </Badge>
          )}
        </div>
      )}
    </Card>
  );
}

function CancellationCard({ cancellation, refund, cancelledAt }) {
  const reasonText = cancellation?.reason
    ? String(cancellation.reason).replace(/_/g, ' ')
    : 'Cancelled';
  const byLabel = cancellation?.cancelledBy
    ? `Cancelled by ${cancellation.cancelledBy}`
    : 'Cancelled';
  return (
    <Card className="bg-rose-50 border border-rose-100">
      <div className="flex items-start gap-3">
        <XCircle className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-rose-900 capitalize">
            {byLabel}
          </p>
          <p className="text-xs text-rose-800 mt-0.5 capitalize">{reasonText}</p>
          {cancelledAt && (
            <p className="text-[11px] text-rose-700/80 mt-1">
              {formatDateTime(cancelledAt)}
            </p>
          )}
        </div>
      </div>
      {refund && refund.amount > 0 && (
        <div className="mt-3 pt-3 border-t border-rose-200/60 flex items-center justify-between text-xs">
          <span className="text-rose-700 font-medium">Refunded</span>
          <span className="text-rose-900 font-semibold">
            {formatRupees(refund.amount)} {refund.method ? `\u00B7 ${refund.method}` : ''}
          </span>
        </div>
      )}
    </Card>
  );
}

function LedgerRow({ label, value }) {
  return (
    <div className="flex items-center justify-between py-1 text-xs">
      <span className="text-text-muted">{label}</span>
      <span className="text-text font-medium">{value}</span>
    </div>
  );
}

export default TripDetailsPage;
