import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  CheckCircle2,
  Flag,
  Loader2,
  MapPin,
  PlayCircle,
  Route,
  XCircle,
  CreditCard,
  Wallet as WalletIcon,
} from 'lucide-react';
import { PAYMENT_POLICY } from '../../../../constants/bookingStatus';
import Card from '../../../../components/Card';
import Button from '../../../../components/Button';
import PersonContactCard from '../../../../components/PersonContactCard';
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
 * Maximum distance (metres) between the driver and the pickup at which
 * the "I have arrived" CTA is enabled. Mirrors `ARRIVAL_PROXIMITY_METERS`
 * on the backend (kept in sync by hand).
 */
const ARRIVAL_PROXIMITY_METERS = 100;

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

  // Distance from the driver's live position to the pickup. Used to
  // gate the "I've arrived" CTA — both as a UX hint and to feed the
  // server's proximity guard with fresh coords on every request.
  const distanceToPickup = useMemo(() => {
    if (!driverPoint || !pickupCoords) return null;
    return haversineMeters(driverPoint, pickupCoords);
  }, [driverPoint, pickupCoords]);

  const isEnRoute = status === BOOKING_STATUS.EN_ROUTE;
  const arrivalReady =
    isEnRoute &&
    distanceToPickup != null &&
    distanceToPickup <= ARRIVAL_PROXIMITY_METERS;

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
    if (action === 'markArrived') {
      if (!driverPoint) {
        toast.error('We need your location to confirm arrival. Enable GPS and try again.');
        return;
      }
      if (distanceToPickup == null || distanceToPickup > ARRIVAL_PROXIMITY_METERS) {
        toast.error(
          `You're too far from the pickup (${formatDistance(distanceToPickup || 0)}). Move within ${ARRIVAL_PROXIMITY_METERS} m to mark arrival.`,
        );
        return;
      }
      try {
        await useDriverActiveTripStore.getState().markArrived(driverPoint);
      } catch (err) {
        toast.error(err?.response?.data?.message || err?.message || 'Could not mark arrival');
      }
      return;
    }
    try {
      await useDriverActiveTripStore.getState()[action]();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Something went wrong');
    }
  }, [config, driverPoint, distanceToPickup]);

  const handleStartWithOtp = useCallback(
    (otp) => useDriverActiveTripStore.getState().startTrip(otp),
    [],
  );

  const handleCancel = useCallback(() => {
    if (!config?.canCancel) return;
    setCancelOpen(true);
  }, [config]);

  // Tick a heartbeat once a second so the cancel preview's grace-window
  // recompute (in `previewDriverCancellation`) reflects the live wall
  // clock. Without this the preview is frozen at mount time and the
  // dialog would happily say "no penalty" 30 seconds after the grace
  // window actually expired.
  const [, setHeartbeat] = useState(0);
  useEffect(() => {
    if (!booking) return undefined;
    const id = setInterval(() => setHeartbeat((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [booking?._id]);

  // Live cancellation preview — recomputes every render (cheap pure
  // function) so the wall-clock heartbeat above drives the copy.
  const cancelPreview = previewDriverCancellation(booking);

  const handleCancelConfirm = useCallback(async () => {
    setCancelling(true);
    const penalty = Number(cancelPreview.driverPenalty) || 0;
    const chancesBefore = Number(cancelPreview.chance?.chancesLeft) || 0;
    try {
      await useDriverActiveTripStore.getState().cancelTrip('cancelled_by_driver');
      if (penalty > 0) {
        toast(`\u20B9${penalty} deducted from your wallet.`, { icon: '\u26A0\uFE0F' });
      } else {
        const left = Math.max(0, chancesBefore - 1);
        toast.success(
          left > 0
            ? `Trip cancelled \u00B7 ${left} free cancel${left === 1 ? '' : 's'} left today`
            : 'Trip cancelled \u00B7 no free cancels left today',
        );
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

  const customer = typeof booking.userId === 'object' ? booking.userId : null;
  const customerName = customer?.name || null;
  // Server populates the user's primary contact field as `phone_no`.
  // Older builds returned `phone`; we honour both so the call CTA keeps
  // working on bookings created before the rename.
  const customerPhone = customer?.phone_no || customer?.phone || null;
  const customerPhoto = customer?.profilePicture || null;

  // The driver-safe fareSnapshot only carries `driverEarning` — the
  // customer's gross fare and the platform commission are stripped on
  // the backend. This is intentional: the driver sees what they make,
  // not what the customer pays.
  const driverEarning = booking.fareSnapshot?.driverEarning || 0;
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
        <PersonContactCard
          src={customerPhoto}
          name={customerName || 'Customer'}
          roleLabel="Customer"
          metaLine={customerPhone || null}
          phone={customerPhone}
          phoneCallLabel="Call customer"
        />

        {/* Waiting timer — only at ARRIVED. Ticks once a second and
            flips colour the moment the free wait expires so the
            driver can see when the meter starts. */}
        {booking.status === BOOKING_STATUS.ARRIVED && (
          <WaitingTimerCard
            arrivedAt={booking.timeline?.arrivedAt}
            freeMinutes={booking.waiting?.freeMinutes}
            perMinuteRupees={booking.waiting?.perMinuteRupees}
          />
        )}

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

        {/* Driver earning — we deliberately don't show the customer's
            gross fare or the platform commission on this screen. The
            number the driver cares about is what lands in their wallet
            after this trip closes out. */}
        <Card>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <WalletIcon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] text-text-muted">Your earning</p>
                <p className="text-base font-bold text-text">
                  {'\u20B9'}{driverEarning}
                </p>
              </div>
            </div>
            {booking.hourly?.durationHours && (
              <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-primary/15 text-primary-dark">
                {booking.hourly.durationHours}h
              </span>
            )}
          </div>
          <p className="text-[11px] text-text-muted mt-2 leading-snug">
            Net amount after platform commission. Credited to your wallet
            once the trip is completed.
          </p>
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
            About {formatDistance(distanceToPickup ?? 0)} to the pickup
          </p>
        )}

        {isEnRoute && (
          <div
            className={`rounded-2xl border p-3 flex items-start gap-3 ${
              arrivalReady
                ? 'border-emerald-200 bg-emerald-50'
                : 'border-amber-200 bg-amber-50'
            }`}
          >
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                arrivalReady ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
              }`}
            >
              <MapPin className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-bold ${arrivalReady ? 'text-emerald-900' : 'text-amber-900'}`}>
                {arrivalReady
                  ? 'You are at the pickup'
                  : driverPoint
                    ? 'Get closer to mark arrival'
                    : 'Waiting for your location'}
              </p>
              <p className={`text-[12px] leading-snug mt-0.5 ${arrivalReady ? 'text-emerald-800' : 'text-amber-800'}`}>
                {arrivalReady
                  ? `Tap "I have arrived" to start the trip with the customer.`
                  : driverPoint
                    ? `You need to be within ${ARRIVAL_PROXIMITY_METERS} m of the pickup before you can mark arrival.`
                    : 'Enable GPS so we can confirm you have reached the pickup.'}
              </p>
            </div>
          </div>
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
            disabled={
              paymentBlocker ||
              busy === 'cancel' ||
              (config.cta.action === 'markArrived' && !arrivalReady)
            }
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
        description={buildCancelDialogCopy(cancelPreview)}
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
 * Pick the right description for the cancel confirm dialog. Three
 * cases the driver needs to disambiguate before tapping Cancel:
 *
 *   1. Free cancel available — within the grace window AND chances left.
 *   2. Penalty applies — past the grace window OR chances exhausted.
 *   3. Mid-trip cancel — penalty applies regardless (customer in car).
 *
 * Copy is intentionally explicit about chances remaining so drivers
 * can budget their daily allowance.
 */
function buildCancelDialogCopy(preview) {
  const penalty = Number(preview?.driverPenalty) || 0;
  const fullPenalty = Number(preview?.fullPenalty) || 0;
  const chance = preview?.chance || null;
  const chancesLeft = Math.max(0, Number(chance?.chancesLeft) || 0);
  const dailyLimit = Math.max(0, Number(chance?.dailyLimit) || 0);
  const grace = Math.max(0, Number(chance?.graceMinutes) || 0);
  const remainingMinutes = Number(chance?.remainingMinutes) || 0;

  if (preview?.tripStarted) {
    return penalty > 0
      ? `\u20B9${penalty} will be deducted from your wallet as a mid-trip cancellation penalty.`
      : 'You are about to cancel a trip in progress. This may affect your rating.';
  }

  // Inside the grace window AND chances remaining → free cancel. Show
  // the live countdown so the driver sees how long they have left.
  if (preview?.penaltyWaived) {
    const remainingAfter = Math.max(0, chancesLeft - 1);
    const countdown = formatGraceRemaining(remainingMinutes);
    const window = `${countdown} left in the ${grace}-min grace window`;
    return remainingAfter > 0
      ? `No penalty \u2014 ${window}. ${remainingAfter} of ${dailyLimit} free cancellation${remainingAfter === 1 ? '' : 's'} will remain today.`
      : `No penalty \u2014 ${window}. This is your last free cancellation today; further cancellations will charge \u20B9${fullPenalty}.`;
  }

  if (penalty > 0) {
    if (chancesLeft <= 0 && dailyLimit > 0) {
      return `Daily free cancellations used up \u2014 \u20B9${penalty} will be deducted from your wallet.`;
    }
    if (grace > 0) {
      return `Grace window of ${grace} minute${grace === 1 ? '' : 's'} has passed \u2014 \u20B9${penalty} will be deducted from your wallet.`;
    }
    return `\u20B9${penalty} will be deducted from your wallet as a cancellation penalty.`;
  }

  return 'Repeated cancellations may affect your rating.';
}

/**
 * Render a `remainingMinutes` float (e.g. 1.42) as a human countdown
 * the driver can read at a glance: "1m 25s" or "12s". Negative or
 * non-numeric → "0s".
 */
function formatGraceRemaining(minutes) {
  const total = Math.max(0, Math.floor((Number(minutes) || 0) * 60));
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

/**
 * Live waiting-timer tile shown on the driver's Active Trip screen
 * once the booking hits ARRIVED. Ticks the wait every second and
 * flips colour the moment the free wait expires so the driver can
 * see when the customer's bill starts climbing.
 *
 * Props:
 *   arrivedAt        ISO timestamp the driver hit "I've arrived".
 *   freeMinutes      Admin-configured free wait window (minutes).
 *   perMinuteRupees  Admin-configured per-minute charge.
 */
function WaitingTimerCard({ arrivedAt, freeMinutes, perMinuteRupees }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!arrivedAt) return null;

  const free = Math.max(0, Number(freeMinutes) || 0);
  const perMin = Math.max(0, Number(perMinuteRupees) || 0);
  const waitedMs = Math.max(0, now - new Date(arrivedAt).getTime());
  const waitedSec = Math.floor(waitedMs / 1000);
  const waitedMin = waitedMs / 60_000;
  const billableMin = Math.max(0, Math.ceil(waitedMin - free));
  const chargedRupees = Math.round(billableMin * perMin * 100) / 100;
  const inFreeWindow = waitedMin <= free;

  // Display formatting
  const m = Math.floor(waitedSec / 60);
  const s = waitedSec % 60;
  const display = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  const remainingFreeSec = Math.max(0, Math.floor(free * 60 - waitedSec));
  const remM = Math.floor(remainingFreeSec / 60);
  const remS = remainingFreeSec % 60;
  const remainingFree = `${remM}m ${String(remS).padStart(2, '0')}s`;

  const tone = inFreeWindow
    ? 'border-l-emerald-500 bg-emerald-50/40'
    : 'border-l-amber-500 bg-amber-50/60';
  const headlineTone = inFreeWindow ? 'text-emerald-700' : 'text-amber-700';

  return (
    <Card className={`border-l-4 ${tone}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-text-muted font-semibold">
            Waiting at pickup
          </p>
          <p className={`text-2xl font-bold mt-1 tabular-nums ${headlineTone}`}>
            {display}
          </p>
          {free > 0 && (
            <p className="text-[11px] text-text-muted mt-0.5">
              {inFreeWindow
                ? `Free wait \u00B7 ${remainingFree} until charges start`
                : `Past free wait of ${free} min`}
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-[11px] uppercase tracking-wide text-text-muted font-semibold">
            Charge so far
          </p>
          <p
            className={`text-base font-bold mt-1 ${
              chargedRupees > 0 ? 'text-amber-700' : 'text-text-muted'
            }`}
          >
            {'\u20B9'}
            {chargedRupees}
          </p>
          {perMin > 0 && (
            <p className="text-[10px] text-text-muted mt-0.5">
              {'\u20B9'}
              {perMin}/min after free
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

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
