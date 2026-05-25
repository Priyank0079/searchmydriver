import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  CheckCircle2,
  Flag,
  Loader2,
  MapPin,
  Phone,
  PlayCircle,
  Route,
  XCircle,
  CreditCard,
} from 'lucide-react';
import { PAYMENT_POLICY } from '../../../../constants/bookingStatus';
import Card from '../../../../components/Card';
import Button from '../../../../components/Button';
import Avatar from '../../../../components/Avatar';
import TripTrackingMap from '../../../../components/maps/TripTrackingMap';
import StartRideOtpSheet from '../components/StartRideOtpSheet';
import ConfirmDialog from '../../../../components/ConfirmDialog';
import { useSocket, useSocketEvent } from '../../../../hooks/useSocket';
import { useGeolocation } from '../../../../hooks/useGeolocation';
import useDriverActiveTripStore from '../../../../store/driver/useDriverActiveTripStore';
import useDriverIncomingOfferStore from '../../../../store/driver/useDriverIncomingOfferStore';
import { S2C_EVENTS, C2S_EVENTS } from '../../../../constants/socketEvents';
import { BOOKING_STATUS } from '../../../../constants/bookingStatus';
import { SERVICE_TYPES, SERVICE_TYPE_LABELS } from '../../../../constants/serviceTypes';
import { formatDistance, haversineMeters } from '../../../../utils/geo';
import { previewDriverCancellation } from '../../../user/booking/utils/cancellationPreview';

/**
 * Driver-side counterpart of `DriverAssignedPage` — one screen that adapts
 * to every post-accept booking status (`driver_assigned` →
 * `awaiting_payment` → `en_route` → `arrived` → `started` → `completed`).
 *
 * The page hydrates once via REST (so deep links and refreshes work) and
 * then patches itself from the `BOOKING_UPDATED` socket event. The next-
 * step CTA is derived from `booking.status` so adding a new transition
 * only requires a new entry in `NEXT_ACTION_BY_STATUS`.
 */

/**
 * Per-status header + CTA. Drivers never see anything payment-related;
 * `AWAITING_PAYMENT` collapses to a neutral "customer is getting ready"
 * line so the driver can't deduce whether the customer is paying upfront
 * or after the ride.
 */
const NEXT_ACTION_BY_STATUS = {
  [BOOKING_STATUS.DRIVER_ASSIGNED]: {
    title: 'Driver assigned',
    subtitle: 'Start when you\u2019re ready to head to the pickup.',
    cta: { label: 'Start to pickup', icon: Route, action: 'markEnRoute' },
    canCancel: true,
  },
  [BOOKING_STATUS.AWAITING_PAYMENT]: {
    title: 'Waiting on customer payment',
    subtitle:
      'The customer is completing payment. You\u2019ll be able to head out as soon as it lands.',
    cta: null,
    canCancel: true,
  },
  [BOOKING_STATUS.EN_ROUTE]: {
    title: 'Heading to pickup',
    subtitle: 'Mark arrival once you\u2019ve reached the pickup location.',
    cta: { label: "I've arrived", icon: Flag, action: 'markArrived' },
    canCancel: true,
  },
  [BOOKING_STATUS.ARRIVED]: {
    title: 'At pickup',
    subtitle: 'Ask the customer for their 4-digit ride code, then start the trip.',
    cta: { label: 'Enter start OTP', icon: PlayCircle, action: 'startTrip' },
    canCancel: true,
  },
  [BOOKING_STATUS.STARTED]: {
    title: 'Trip in progress',
    subtitle: 'Drive safe. Mark complete when the booked duration is over.',
    cta: { label: 'Complete trip', icon: CheckCircle2, action: 'completeTrip' },
    // Driver-side cancel after STARTED is allowed but the admin-configured
    // penalty is debited from the driver's wallet (see backend
    // computeDriverCancellation). The handleCancel confirm-dialog spells
    // the deduction out so the driver knows before they commit.
    canCancel: true,
  },
};

const ACTIVE_STATUSES_ON_PAGE = Object.keys(NEXT_ACTION_BY_STATUS);

/** Statuses on which it makes sense to show the live tracking map. */
const STATUSES_WITH_MAP = [
  BOOKING_STATUS.DRIVER_ASSIGNED,
  BOOKING_STATUS.AWAITING_PAYMENT,
  BOOKING_STATUS.EN_ROUTE,
  BOOKING_STATUS.ARRIVED,
];

const DriverActiveTripPage = () => {
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const { emit, isConnected } = useSocket();

  const booking = useDriverActiveTripStore((s) => s.booking);
  const loading = useDriverActiveTripStore((s) => s.loading);
  const busy = useDriverActiveTripStore((s) => s.busy);
  const error = useDriverActiveTripStore((s) => s.error);
  const fetchById = useDriverActiveTripStore((s) => s.fetchById);
  const fetchActive = useDriverActiveTripStore((s) => s.fetchActive);
  const applyUpdate = useDriverActiveTripStore((s) => s.applyUpdate);
  const clear = useDriverActiveTripStore((s) => s.clear);

  // When the trip completes/cancels, also clear the incoming-offer store's
  // `activeBooking` mirror so the rest of the driver app sees a clean slate.
  const clearOfferStoreActive = useDriverIncomingOfferStore(
    (s) => s.clearActiveBooking,
  );

  // Hydrate: prefer the route id (so refreshes and deep links work) and
  // fall back to "the driver's currently active booking" if the route id
  // is missing or stale.
  useEffect(() => {
    if (routeId) {
      fetchById(routeId).catch(() => {
        // Maybe the id is wrong or the trip is already over — try /active.
        fetchActive().catch(() => {});
      });
    } else {
      fetchActive().catch(() => {});
    }
  }, [routeId, fetchById, fetchActive]);

  // Live patches.
  useSocketEvent(S2C_EVENTS.BOOKING_UPDATED, (payload) => {
    applyUpdate(payload);
  });

  // Join the booking room — same pattern as the user side. The driver
  // receives the same room broadcasts as the user, which is useful for
  // Phase 5 (ETA, location, chat).
  useEffect(() => {
    const id = booking?._id;
    if (!id || !isConnected) return undefined;
    emit(C2S_EVENTS.BOOKING_JOIN, { bookingId: id });
    return () => emit(C2S_EVENTS.BOOKING_LEAVE, { bookingId: id });
  }, [booking?._id, isConnected, emit]);

  // When the booking reaches a terminal state, leave the page so the
  // driver lands back on the dashboard for their next offer.
  const status = booking?.status;
  const cancellationReason = booking?.cancellation?.reason;
  useEffect(() => {
    if (!status) return;
    if (status === BOOKING_STATUS.COMPLETED) {
      toast.success('Trip completed');
      clear();
      clearOfferStoreActive();
      navigate('/driver/home', { replace: true });
    } else if (
      status === BOOKING_STATUS.CANCELLED ||
      status === BOOKING_STATUS.NO_DRIVERS_FOUND
    ) {
      // Pick the right toast for why this booking ended. The reason
      // string is stamped onto `booking.cancellation` by the backend.
      if (cancellationReason === 'payment_timeout') {
        toast.error(
          'Booking cancelled — customer did not complete payment in time.',
          { duration: 6000 },
        );
      } else if (
        cancellationReason === 'cancelled_by_user' ||
        cancellationReason === 'cancelled_before_payment'
      ) {
        toast('Customer cancelled the ride.', { icon: 'ℹ️', duration: 5000 });
      } else if (cancellationReason === 'cancelled_by_user_after_start') {
        toast('Customer cancelled mid-ride. Cancellation fee applied.', {
          icon: 'ℹ️',
          duration: 6000,
        });
      }
      clear();
      clearOfferStoreActive();
      navigate('/driver/home', { replace: true });
    }
  }, [status, cancellationReason, clear, clearOfferStoreActive, navigate]);

  // OTP-entry sheet: opened from the Start CTA when the booking is at
  // ARRIVED. We keep it page-local rather than baking it into the store
  // because it's purely a UI concern.
  const [otpOpen, setOtpOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // The driver's live location for the trip map. `useGeolocation` is shared
  // with the home screen so the user gets a single permission prompt.
  const { coords: driverCoords } = useGeolocation({ enabled: true });
  const driverPoint = useMemo(
    () => (driverCoords ? { lat: driverCoords.lat, lng: driverCoords.lng } : null),
    [driverCoords],
  );
  // Pickup coordinates from the booking — derived above the early returns
  // so the `useMemo` ordering stays stable on every render. The page's
  // first render has `booking == null`, but the hook still has to fire.
  const pickupCoords = useMemo(() => {
    const c = booking?.pickup?.location?.coordinates;
    if (!Array.isArray(c) || c.length !== 2) return null;
    return { lat: c[1], lng: c[0] };
  }, [booking?.pickup]);

  // Resolve the next-action descriptor every render so it tracks the
  // current status without us juggling an effect.
  const config = useMemo(
    () => (status ? NEXT_ACTION_BY_STATUS[status] : null),
    [status],
  );

  const handleAdvance = useCallback(async () => {
    if (!config?.cta) return;
    const action = config.cta.action;
    // ARRIVED → opens the OTP entry sheet instead of calling startTrip
    // directly. The sheet itself drives the POST once the driver enters
    // the code the customer reads out.
    if (action === 'startTrip') {
      setOtpOpen(true);
      return;
    }
    try {
      await useDriverActiveTripStore.getState()[action]();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Something went wrong');
    }
  }, [config]);

  const handleStartWithOtp = useCallback(
    (otp) => useDriverActiveTripStore.getState().startTrip(otp),
    [],
  );

  const handleCancel = useCallback(() => {
    if (!config?.canCancel) return;
    setCancelOpen(true);
  }, [config]);

  // Live cancellation preview — kept reactive so a STARTED transition
  // during the confirm prompt updates the warning copy automatically.
  const cancelPreview = useMemo(
    () => previewDriverCancellation(booking),
    [booking],
  );

  const handleCancelConfirm = useCallback(async () => {
    setCancelling(true);
    const tripStarted = !!cancelPreview.tripStarted;
    const penalty = Number(cancelPreview.driverPenalty) || 0;
    try {
      await useDriverActiveTripStore.getState().cancelTrip('cancelled_by_driver');
      if (tripStarted && penalty > 0) {
        toast(`\u20B9${penalty} deducted from your wallet.`, { icon: '\u26A0\uFE0F' });
      } else {
        toast.success('Trip cancelled');
      }
      setCancelOpen(false);
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Could not cancel');
    } finally {
      setCancelling(false);
    }
  }, [cancelPreview]);

  if (loading && !booking) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bg min-h-dvh">
        <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-bg min-h-dvh px-6 text-center gap-3">
        <XCircle className="w-10 h-10 text-text-muted" />
        <h2 className="text-base font-bold text-text">No active trip</h2>
        <p className="text-sm text-text-muted max-w-xs">
          {error || 'You don\u2019t have a booking in progress right now. New offers will appear here.'}
        </p>
        <Button variant="secondary" onClick={() => navigate('/driver/home')}>
          Back to dashboard
        </Button>
      </div>
    );
  }

  // Trip already completed/cancelled but the navigation effect hasn't
  // fired yet — render nothing to avoid a flash.
  if (!ACTIVE_STATUSES_ON_PAGE.includes(booking.status)) {
    return null;
  }

  const customer = booking.userId;
  const customerName = typeof customer === 'object' ? customer?.name : null;
  const customerPhone = typeof customer === 'object' ? customer?.phone : null;

  const fare = booking.fareSnapshot?.total || 0;
  // The only thing that "blocks" the driver's En-Route CTA today is the
  // AWAITING_PAYMENT status. Treating it as a neutral "customer is getting
  // ready" hint keeps the payment-mode private (per spec).
  const paymentBlocker = booking.status === BOOKING_STATUS.AWAITING_PAYMENT;

  const titleLine =
    booking.serviceType === SERVICE_TYPES.OUTSTATION
      ? `${booking.outstation?.days || 1}-day Outstation`
      : `${booking.hourly?.durationHours || ''}h ${SERVICE_TYPE_LABELS.hourly || 'Hourly'}`;

  const showMap = STATUSES_WITH_MAP.includes(booking.status) && pickupCoords;

  return (
    <div className="flex-1 flex flex-col bg-bg min-h-dvh">
      {/* Header */}
      <div className="bg-white border-b border-border-light px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/driver/home')}
          className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center"
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="w-5 h-5 text-text" />
        </button>
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-text-muted font-semibold">
            {config.title}
          </p>
          <p className="text-sm font-bold text-text truncate">{titleLine}</p>
        </div>
        <span className="ml-auto text-[11px] text-text-muted font-mono">
          {booking.bookingNumber}
        </span>
      </div>

      <div className="flex-1 p-4 space-y-4">
        {/* Live map: driver + pickup, emphasising the pickup pin */}
        {showMap && (
          <TripTrackingMap
            driver={driverPoint}
            pickup={pickupCoords}
            emphasis="pickup"
            height={240}
            showRoute={booking.status !== BOOKING_STATUS.ARRIVED}
          />
        )}

        {/* Status banner */}
        <Card>
          <p className="text-sm text-text-secondary leading-snug">{config.subtitle}</p>
        </Card>

        {/* Customer */}
        <Card>
          <div className="flex items-start gap-3">
            <Avatar name={customerName || 'Customer'} size="lg" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-text-muted">Customer</p>
              <p className="text-sm font-bold text-text truncate">
                {customerName || 'Customer'}
              </p>
              {customerPhone && (
                <p className="text-[11px] text-text-muted font-mono">{customerPhone}</p>
              )}
            </div>
            {customerPhone && (
              <a
                href={`tel:${customerPhone}`}
                className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center hover:bg-emerald-100"
                aria-label="Call customer"
              >
                <Phone className="w-4 h-4" />
              </a>
            )}
          </div>
        </Card>

        {/* Trip details */}
        <Card>
          <h3 className="text-xs font-semibold text-text-muted mb-3 uppercase tracking-wide">
            Trip
          </h3>
          <div className="flex items-start gap-3">
            <MapPin className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] text-text-muted">Pickup</p>
              <p className="text-sm font-medium text-text break-words">
                {booking.pickup?.address}
              </p>
            </div>
          </div>
          {booking.outstation?.destinationAddress && (
            <div className="flex items-start gap-3 mt-3">
              <MapPin className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[11px] text-text-muted">Destination</p>
                <p className="text-sm font-medium text-text break-words">
                  {booking.outstation.destinationAddress}
                </p>
              </div>
            </div>
          )}
        </Card>

        {/* Fare — the driver sees the worth of the trip; payment timing is hidden */}
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] text-text-muted">Estimated fare</p>
              <p className="text-base font-bold text-text">₹{fare}</p>
            </div>
            {booking.hourly?.durationHours && (
              <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-primary/15 text-primary-dark">
                {booking.hourly.durationHours}h
              </span>
            )}
          </div>
        </Card>

        {/* Extensions */}
        {Array.isArray(booking.extensions) && booking.extensions.length > 0 && (
          <Card>
            <p className="text-[11px] text-text-muted uppercase tracking-wide font-semibold">
              Extensions
            </p>
            <div className="mt-2 space-y-1">
              {booking.extensions.map((ext) => (
                <p key={String(ext._id || ext.requestedAt)} className="text-xs text-text-secondary">
                  +{ext.additionalHours}h ·{' '}
                  <span className="text-text-muted">
                    requested {new Date(ext.requestedAt).toLocaleTimeString()}
                  </span>
                </p>
              ))}
            </div>
          </Card>
        )}

        {driverPoint && pickupCoords && booking.status !== BOOKING_STATUS.STARTED && (
          <p className="text-[11px] text-text-muted text-center">
            About {formatDistance(haversineMeters(driverPoint, pickupCoords))} to the pickup
          </p>
        )}
      </div>

      {/* Pay-first overlay: while the customer is settling the fare we lock
          the driver behind a non-dismissible "user is making payment" sheet.
          If the customer doesn't pay in time the server auto-cancels and
          the booking transitions to CANCELLED (handled by the effect above). */}
      <CustomerPaymentOverlay
        open={paymentBlocker}
        paymentDeadlineAt={booking.timeline?.paymentDeadlineAt}
        driverAssignedAt={booking.timeline?.driverAssignedAt}
      />

      <StartRideOtpSheet
        open={otpOpen}
        onClose={() => setOtpOpen(false)}
        onSubmit={handleStartWithOtp}
        busy={busy === 'start'}
      />

      {/* Sticky action bar */}
      <div className="sticky bottom-0 bg-white border-t border-border-light px-4 py-3 space-y-2 z-10">
        {config.cta && (
          <Button
            fullWidth
            variant="driver"
            disabled={paymentBlocker || busy === 'cancel'}
            loading={busy === config.cta.action}
            icon={config.cta.icon}
            onClick={handleAdvance}
          >
            {config.cta.label}
          </Button>
        )}
        {config.canCancel && (
          <button
            type="button"
            disabled={!!busy && busy !== 'cancel'}
            onClick={handleCancel}
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 text-red-600 font-semibold py-3 text-sm disabled:opacity-60 hover:bg-red-100 transition"
          >
            <XCircle className="w-4 h-4" />
            Cancel trip
          </button>
        )}
      </div>

      <ConfirmDialog
        open={cancelOpen}
        onClose={() => !cancelling && setCancelOpen(false)}
        onConfirm={handleCancelConfirm}
        title={cancelPreview.tripStarted ? 'Cancel this active trip?' : 'Cancel this trip?'}
        description={
          cancelPreview.tripStarted && Number(cancelPreview.driverPenalty) > 0
            ? `\u20B9${Number(cancelPreview.driverPenalty)} will be deducted from your wallet as a cancellation penalty.`
            : 'Repeated cancellations may affect your rating.'
        }
        confirmLabel="Cancel trip"
        cancelLabel="Keep trip"
        variant="danger"
        loading={cancelling}
      />
    </div>
  );
};

/* ------------------------------------------------------------------ */

/**
 * Full-screen overlay that locks the driver while the customer settles
 * the fare. The 1-minute countdown is informational only — the actual
 * timer lives server-side. When it fires the booking transitions to
 * CANCELLED (and the page-level effect above redirects the driver home).
 */
function CustomerPaymentOverlay({ open, paymentDeadlineAt, driverAssignedAt }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!open) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [open]);

  // Prefer the explicit deadline (refreshed on every customer retry).
  // Fall back to the legacy assignedAt-based math so pre-migration
  // bookings still show a sane countdown.
  const remainingSec = useMemo(() => {
    const deadlineMs = paymentDeadlineAt
      ? new Date(paymentDeadlineAt).getTime()
      : driverAssignedAt
        ? new Date(driverAssignedAt).getTime() +
          PAYMENT_POLICY.PAYMENT_DEADLINE_SECONDS * 1000
        : null;
    if (!deadlineMs) return PAYMENT_POLICY.PAYMENT_DEADLINE_SECONDS;
    return Math.max(0, Math.ceil((deadlineMs - now) / 1000));
  }, [paymentDeadlineAt, driverAssignedAt, now]);

  if (!open) return null;

  const minutes = Math.floor(remainingSec / 60);
  const seconds = String(remainingSec % 60).padStart(2, '0');
  const countdown = `${minutes}:${seconds}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative w-full max-w-sm rounded-3xl bg-white shadow-2xl p-6 text-center">
        <div className="relative mx-auto w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-4">
          <CreditCard className="w-7 h-7 text-amber-700" />
          <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white border-2 border-amber-100 flex items-center justify-center">
            <Loader2 className="w-4 h-4 animate-spin text-amber-700" />
          </span>
        </div>
        <h3 className="text-base font-bold text-text">User is making payment</h3>
        <p className="mt-1.5 text-sm text-text-muted leading-snug">
          Please hold &mdash; the customer is completing payment. You&rsquo;ll
          be able to head out as soon as it lands.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[12px] font-semibold">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Auto-cancels in {countdown}
        </div>
        <p className="mt-4 text-[11px] text-text-muted leading-snug">
          If the customer doesn&rsquo;t pay in time the booking is cancelled
          automatically and you&rsquo;ll be released to take new offers.
        </p>
      </div>
    </div>
  );
}

export default DriverActiveTripPage;
