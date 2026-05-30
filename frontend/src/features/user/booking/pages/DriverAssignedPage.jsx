import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  MapPin,
  CreditCard,
  Wallet,
  Loader2,
  X,
  Route,
  CheckCircle2,
  PlayCircle,
  Clock,
  Timer as TimerIcon,
} from 'lucide-react';
import Card from '../../../../components/Card';
import Button from '../../../../components/Button';
import PersonContactCard from '../../../../components/PersonContactCard';
import TripTrackingMap from '../../../../components/maps/TripTrackingMap';
import useUserActiveBookingStore from '../../../../store/user/useUserActiveBookingStore';
import useUserWalletStore from '../../../../store/user/useUserWalletStore';
import { useSocket, useSocketEvent } from '../../../../hooks/useSocket';
import { useFirebaseDriverLocations } from '../../../../hooks/useFirebaseDriverLocations';
import { useFareEstimate } from '../hooks/useFareEstimate';
import { useRideTimer } from '../hooks/useRideTimer';
import { S2C_EVENTS, C2S_EVENTS } from '../../../../constants/socketEvents';
import {
  BOOKING_STATUS,
  BOOKING_PAYMENT_STATUS,
} from '../../../../constants/bookingStatus';
import { SERVICE_TYPES } from '../../../../constants/serviceTypes';
import { haversineMeters, formatDistance } from '../../../../utils/geo';
import useBookingDraftStore from '../../../../store/user/useBookingDraftStore';
import PaymentChoiceSheet from '../components/PaymentChoiceSheet';
import RideStartOtpCard from '../components/RideStartOtpCard';
import ExtendRideModal from '../components/ExtendRideModal';
import ConfirmDialog from '../../../../components/ConfirmDialog';
import { previewUserCancellation } from '../utils/cancellationPreview';

/**
 * Maps every status the user can be on while their booking is live to the
 * header copy + icon they see at the top of the page. Adding a new status
 * is a one-line change — the rest of the screen (driver card, payment card,
 * cancel button) keys off `canCancel` here and `paymentBlocker` derived
 * below.
 */
const STATUS_VIEW = {
  [BOOKING_STATUS.DRIVER_ASSIGNED]: {
    icon: '\u2713',
    title: 'Driver assigned',
    subtitle: 'Your driver will start heading to you soon.',
  },
  [BOOKING_STATUS.AWAITING_PAYMENT]: {
    icon: 'timer',
    title: 'Confirm payment to start',
    subtitle:
      'Pay within 1 minute to confirm your ride. Your driver is held until payment lands.',
  },
  [BOOKING_STATUS.EN_ROUTE]: {
    icon: 'route',
    title: 'Driver on the way',
    subtitle: 'Your driver is heading to the pickup.',
  },
  [BOOKING_STATUS.ARRIVED]: {
    icon: 'flag',
    title: 'Driver has arrived',
    subtitle: 'Meet your driver at the pickup location to start the trip.',
  },
  [BOOKING_STATUS.STARTED]: {
    icon: 'play',
    title: 'Trip in progress',
    subtitle: 'Enjoy your ride. Cancellation is no longer available.',
  },
};

function StatusIcon({ icon }) {
  if (icon === 'route') return <Route className="w-5 h-5 text-emerald-700" />;
  if (icon === 'flag') return <CheckCircle2 className="w-5 h-5 text-amber-700" />;
  if (icon === 'play') return <PlayCircle className="w-5 h-5 text-sky-700" />;
  if (icon === 'timer') return <TimerIcon className="w-5 h-5 text-red-600" />;
  return <span className="text-xl">{icon}</span>;
}

const DriverAssignedPage = () => {
  const navigate = useNavigate();
  const booking = useUserActiveBookingStore((s) => s.booking);
  const fetchActive = useUserActiveBookingStore((s) => s.fetchActive);
  const applyUpdate = useUserActiveBookingStore((s) => s.applyUpdate);
  const cancelBooking = useUserActiveBookingStore((s) => s.cancelBooking);
  const createExtension = useUserActiveBookingStore((s) => s.createExtension);
  const draftReset = useBookingDraftStore((s) => s.reset);
  const fetchWallet = useUserWalletStore((s) => s.fetchWallet);
  const { emit, isConnected } = useSocket();

  const [cancelling, setCancelling] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  // Whether the user has already dismissed the extension prompt for the
  // current "you're past the booked time" window. Reset every time a new
  // extension lands (so the next overflow can prompt again).
  const [extensionPromptOpen, setExtensionPromptOpen] = useState(false);
  const [extensionPromptDismissedAt, setExtensionPromptDismissedAt] = useState(null);

  useEffect(() => {
    if (!booking) fetchActive().catch(() => {});
  }, [booking, fetchActive]);

  // Join the booking room so the driver, user, and any admin watching get the
  // same trip-room broadcasts (Phase 5 will lean on this for live ETA).
  useEffect(() => {
    if (!booking?._id || !isConnected) return undefined;
    emit(C2S_EVENTS.BOOKING_JOIN, { bookingId: booking._id });
    return () => emit(C2S_EVENTS.BOOKING_LEAVE, { bookingId: booking._id });
  }, [booking?._id, isConnected, emit]);

  useSocketEvent(S2C_EVENTS.BOOKING_UPDATED, (payload) => {
    applyUpdate(payload);
  });

  // No-show prompt: backend pings us when the driver has been at the
  // pickup for `noShowPromptMinutes` without the trip starting. We
  // open a modal asking the customer if they're still coming, with a
  // deadline matching the server-side auto-complete timer.
  const [noShowPrompt, setNoShowPrompt] = useState(null);
  useSocketEvent(S2C_EVENTS.BOOKING_NOSHOW_PROMPT, (payload) => {
    if (!payload?.bookingId) return;
    if (booking?._id && String(booking._id) !== String(payload.bookingId)) {
      return;
    }
    setNoShowPrompt({
      promptDeadlineAt: payload.promptDeadlineAt,
      graceMinutes: payload.graceMinutes,
    });
  });
  // Re-attach the prompt on page reload — backend already stamped the
  // booking with `noShow.promptDeadlineAt` so we can rehydrate the
  // modal without waiting for a fresh socket event.
  useEffect(() => {
    const deadline = booking?.noShow?.promptDeadlineAt;
    const response = booking?.noShow?.customerResponse;
    if (!deadline || response) {
      // Customer already answered → hide.
      if (response && noShowPrompt) setNoShowPrompt(null);
      return;
    }
    const remaining = new Date(deadline).getTime() - Date.now();
    if (remaining <= 0) {
      // Deadline already passed; backend will auto-complete momentarily.
      setNoShowPrompt(null);
      return;
    }
    if (!noShowPrompt) {
      setNoShowPrompt({ promptDeadlineAt: deadline, graceMinutes: null });
    }
  }, [booking?.noShow?.promptDeadlineAt, booking?.noShow?.customerResponse]);

  const respondToNoShow = useUserActiveBookingStore((s) => s.respondToNoShow);
  const handleNoShowAnswer = async (answer) => {
    try {
      await respondToNoShow(answer);
      setNoShowPrompt(null);
      if (answer === 'on_my_way') {
        toast.success('Thanks — we let your driver know.');
      } else {
        toast('Trip closed out. Driver has been paid for waiting.', {
          icon: '\u26A0\uFE0F',
        });
      }
    } catch (err) {
      toast.error(
        err?.response?.data?.message || err?.message || 'Could not send response',
      );
    }
  };

  const bookingStatus = booking?.status;
  const cancellationReason = booking?.cancellation?.reason;
  const refundSummary = booking?.refund;
  useEffect(() => {
    if (!bookingStatus) return;
    if (bookingStatus === BOOKING_STATUS.CANCELLED) {
      // Auto-cancel from the payment timeout is a special case — we want
      // the user to understand why the booking went away. Other cancellation
      // sources (user/driver/admin) already have their own UX paths so we
      // stay quiet there.
      if (cancellationReason === 'payment_timeout') {
        toast.error(
          'Your booking was cancelled — payment was not completed in time.',
          { duration: 6000 },
        );
      } else if (
        cancellationReason === 'cancelled_by_driver' ||
        cancellationReason === 'cancelled_by_driver_after_start'
      ) {
        const refundAmt = Number(refundSummary?.amountRupees) || 0;
        if (refundAmt > 0) {
          toast.success(
            `Driver cancelled. Refund of ₹${refundAmt} is on its way.`,
            { duration: 6000 },
          );
        } else {
          toast('Driver cancelled the ride.', { icon: 'ℹ️', duration: 5000 });
        }
      }
      // Cancellation refund (wallet) settles on the backend the moment
      // the booking flips — pull a fresh wallet snapshot so the home /
      // wallet pages render the new balance without a manual refresh.
      fetchWallet().catch(() => {});
      draftReset();
      navigate('/user/home', { replace: true });
    }
    if (bookingStatus === BOOKING_STATUS.COMPLETED) {
      draftReset();
      navigate('/user/home', { replace: true });
    }
    if (
      bookingStatus === BOOKING_STATUS.SEARCHING &&
      cancellationReason === 'driver_cancelled_reassigning'
    ) {
      // Driver bailed and we're re-dispatching. Hand off to the searching
      // page so the user sees the same "finding driver" UX as a fresh
      // booking. The popup is surfaced there via the same cancellation
      // reason.
      navigate('/user/book/searching', { replace: true });
    }
  }, [bookingStatus, cancellationReason, refundSummary, navigate, draftReset, fetchWallet]);

  const driver = booking?.driverId;
  const driverId = typeof driver === 'object' ? driver?._id : driver;

  // Live driver location via Firebase (Phase 3 pipeline).
  const { map: firebaseMap, disabled: firebaseDisabled } = useFirebaseDriverLocations();
  const liveDriver = driverId ? firebaseMap[String(driverId)] : null;

  const pickupPoint = useMemo(() => {
    const c = booking?.pickup?.location?.coordinates;
    if (!Array.isArray(c) || c.length !== 2) return null;
    return { lat: c[1], lng: c[0] };
  }, [booking?.pickup]);

  const driverPoint = useMemo(() => {
    if (!liveDriver) return null;
    return { lat: liveDriver.lat, lng: liveDriver.lng };
  }, [liveDriver]);

  const distanceMeters = useMemo(() => {
    if (!driverPoint || !pickupPoint) return null;
    return haversineMeters(driverPoint, pickupPoint);
  }, [driverPoint, pickupPoint]);

  /**
   * Driver vehicle expertise we want to surface as the "Drives:" line
   * on the driver card. Merges `vehicleExperience` (specific cars the
   * driver has logged) with `carTypeExperience` (broader categories)
   * and de-dupes, then caps to 3 entries to keep the line tight.
   */
  const driverExpertise = useMemo(() => {
    const ve = Array.isArray(driver?.vehicleExperience)
      ? driver.vehicleExperience
      : [];
    const cte = Array.isArray(driver?.carTypeExperience)
      ? driver.carTypeExperience
      : [];
    const fromVehicles = ve
      .map((v) => v?.modelName || v?.brandName || v?.categoryName)
      .filter(Boolean);
    const fromTypes = cte.map((c) => c?.name).filter(Boolean);
    return [...new Set([...fromVehicles, ...fromTypes])].slice(0, 3);
  }, [driver]);

  // Ride duration timer + extension prompt (only active once STARTED).
  const rideTimer = useRideTimer(booking);

  // Pull the extra-hour rate from the live pricing service so the extension
  // modal can quote a realistic number before the user commits.
  const fareEstimatePayload = useMemo(() => {
    if (!booking || booking.serviceType !== SERVICE_TYPES.HOURLY) return null;
    return {
      serviceType: booking.serviceType,
      bookedHours: booking.hourly?.durationHours,
      slabId: booking.hourly?.slabId || undefined,
      scheduledAt: booking.hourly?.scheduledStartAt,
    };
  }, [booking]);
  const { estimate: liveEstimate } = useFareEstimate(fareEstimatePayload);
  const extraHourRate = useMemo(() => {
    const bd = liveEstimate?.fareBreakdown || booking?.fareSnapshot?.breakdown || {};
    // Pricing engine exposes the rate as part of the hourly breakdown only
    // when an extra hour was charged. Fall back to the configured rate when
    // present, otherwise approximate as base-fare / bookedHours.
    if (bd.extraHourCharge && bd.extraHours) {
      return Math.round(bd.extraHourCharge / bd.extraHours);
    }
    if (bd.packagePrice && booking?.hourly?.durationHours) {
      return Math.round(bd.packagePrice / booking.hourly.durationHours);
    }
    return 0;
  }, [liveEstimate, booking]);

  // Open the extension prompt as soon as we cross the lead-time threshold
  // — but never more than once per dismissal window. The user can also tap
  // the persistent "Extend ride" pill from the trip card.
  useEffect(() => {
    if (!rideTimer.shouldPromptExtension) return;
    if (extensionPromptOpen) return;
    if (extensionPromptDismissedAt && Date.now() - extensionPromptDismissedAt < 60_000) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- canonical timer trigger
    setExtensionPromptOpen(true);
  }, [rideTimer.shouldPromptExtension, extensionPromptOpen, extensionPromptDismissedAt]);

  const handleCancel = async () => {
    if (cancelling) return;
    setCancelConfirmOpen(true);
  };

  const cancelPreview = useMemo(
    () => previewUserCancellation(booking),
    [booking],
  );

  const handleCancelConfirm = async () => {
    const tripStarted = !!cancelPreview.tripStarted;
    const fee = Number(cancelPreview.feeCharged) || 0;
    setCancelling(true);
    try {
      await cancelBooking(
        tripStarted ? 'cancelled_by_user_after_start' : 'cancelled_by_user',
      );
      if (fee > 0) {
        toast(`Cancellation fee \u20B9${fee} applied.`, { icon: '\u26A0\uFE0F' });
      }
      draftReset();
      setCancelConfirmOpen(false);
      navigate('/user/home', { replace: true });
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not cancel');
    } finally {
      setCancelling(false);
    }
  };

  if (!booking) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bg min-h-dvh">
        <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
      </div>
    );
  }

  const isPaid = booking.paymentStatus === BOOKING_PAYMENT_STATUS.PAID;
  const isAwaitingPayment = booking.status === BOOKING_STATUS.AWAITING_PAYMENT;
  const baseTotal = booking.fareSnapshot?.total || 0;
  const extensionsTotal = (booking.extensions || []).reduce(
    (sum, ext) => sum + (ext?.fareDelta || 0),
    0,
  );
  // Effective total = base + every accepted extension. The payment service
  // does the same math server-side so the two numbers always agree.
  const total = baseTotal + extensionsTotal;
  const amountPaid = booking.payment?.amountPaidRupees || 0;
  const payNowAmount = Math.max(0, total - amountPaid);

  // Cancel CTA is available at every active status now. The backend
  // applies the admin-configured cancellation fee post-STARTED; the
  // confirm dialog above warns the user about it before they commit.
  const cancellable = true;
  const view = STATUS_VIEW[booking.status] || STATUS_VIEW[BOOKING_STATUS.DRIVER_ASSIGNED];

  return (
    <div className="flex-1 flex flex-col bg-bg min-h-dvh">
      <div className="bg-success-light/60 px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-success/15 rounded-2xl flex items-center justify-center">
            <StatusIcon icon={view.icon} />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-text">{view.title}</h1>
            <p className="text-xs text-text-muted truncate">{booking.bookingNumber}</p>
          </div>
        </div>
        <p className="text-[12px] text-text-secondary mt-2 leading-snug">{view.subtitle}</p>
      </div>

      <div className="flex-1 p-4 space-y-4">
        {/* Live driver tracking map. We only render it when we actually
            have the pickup coordinates — early/legacy bookings without one
            silently skip the map block. */}
        {pickupPoint && booking.status !== BOOKING_STATUS.STARTED && (
          <TripTrackingMap
            driver={driverPoint}
            pickup={pickupPoint}
            emphasis="driver"
            height={220}
            showRoute={booking.status !== BOOKING_STATUS.ARRIVED}
          />
        )}

        {/* OTP for the driver — shown only on arrival, never carried in
            broadcasts that admins or the driver could see. */}
        {booking.status === BOOKING_STATUS.ARRIVED && booking.rideStartOtp?.code && (
          <RideStartOtpCard code={booking.rideStartOtp.code} />
        )}

        <PersonContactCard
          src={driver?.profilePicture}
          name={driver?.name || 'Your driver'}
          roleLabel="Driver"
          online={!!liveDriver}
          rating={driver?.rating}
          experienceYears={driver?.experienceYears}
          expertise={driverExpertise}
          metaLine={
            liveDriver
              ? `${formatDistance(distanceMeters)} away`
              : firebaseDisabled
                ? 'Awaiting driver location\u2026'
                : 'Locating driver\u2026'
          }
          phone={driver?.phone_no || driver?.phone}
          showMessageButton
        />

        <Card>
          <h3 className="text-sm font-semibold text-text mb-3">Trip</h3>
          <div className="flex items-start gap-3">
            <MapPin className="w-4 h-4 text-success mt-1 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-text-muted">Pickup</p>
              <p className="text-sm font-medium text-text break-words">{booking.pickup?.address}</p>
            </div>
          </div>
          {booking.outstation?.destinationAddress && (
            <div className="flex items-start gap-3 mt-3">
              <MapPin className="w-4 h-4 text-danger mt-1 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-text-muted">Destination</p>
                <p className="text-sm font-medium text-text break-words">
                  {booking.outstation.destinationAddress}
                </p>
              </div>
            </div>
          )}
        </Card>

        {/* In-ride duration tracker. Only renders while the ride is live
            so it doesn't leak into the pre-arrival flow. */}
        {rideTimer.isStarted && rideTimer.scheduledEndAt && (
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center">
                <Clock className="w-4 h-4 text-primary-dark" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-text-muted">
                  {rideTimer.remainingSeconds >= 0
                    ? 'Time remaining'
                    : 'You are over the booked duration'}
                </p>
                <p
                  className={`text-base font-bold ${
                    rideTimer.remainingSeconds < 0 ? 'text-danger' : 'text-text'
                  }`}
                >
                  {formatRideClock(Math.abs(rideTimer.remainingSeconds))}
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setExtensionPromptOpen(true)}
              >
                Extend ride
              </Button>
            </div>
          </Card>
        )}

        <Card>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {isPaid ? (
                <CreditCard className="w-5 h-5 text-success shrink-0" />
              ) : (
                <Wallet className="w-5 h-5 text-amber-700 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-xs text-text-muted">Payment</p>
                <p className="text-sm font-semibold text-text truncate">
                  {paymentSummary({ isPaid, isAwaitingPayment, total, payNowAmount })}
                </p>
              </div>
            </div>
          </div>
          {isAwaitingPayment && !isPaid && (
            <p className="mt-2 text-[11px] text-amber-700">
              Complete the payment in the popup — your driver is waiting.
            </p>
          )}
        </Card>
      </div>

      {cancellable && (
        <div className="p-4 bg-white border-t border-border-light">
          <button
            type="button"
            disabled={cancelling}
            onClick={handleCancel}
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 text-red-600 font-semibold py-3 text-sm disabled:opacity-60 hover:bg-red-100 transition"
          >
            <X className="w-4 h-4" />
            {cancelling ? 'Cancelling…' : 'Cancel booking'}
          </button>
        </div>
      )}

      <ConfirmDialog
        open={cancelConfirmOpen}
        onClose={() => !cancelling && setCancelConfirmOpen(false)}
        onConfirm={handleCancelConfirm}
        title={cancelPreview.tripStarted ? 'Cancel this trip?' : 'Cancel this booking?'}
        description={cancelPreviewMessage(cancelPreview)}
        confirmLabel="Yes, cancel"
        cancelLabel="Keep booking"
        variant="danger"
        loading={cancelling}
      />

      {/* The pay-first sheet is driven purely by booking status — it is
          non-dismissible so the user can't sidestep the deadline. */}
      <PaymentChoiceSheet
        open={isAwaitingPayment && !isPaid}
        onClose={() => {
          /* sheet only closes via successful payment / status change */
        }}
        booking={booking}
      />

      <ExtendRideModal
        open={extensionPromptOpen}
        onClose={() => {
          setExtensionPromptOpen(false);
          setExtensionPromptDismissedAt(Date.now());
        }}
        onSubmit={(hours) => createExtension(hours)}
        extraHourRate={extraHourRate}
        remainingMinutes={
          rideTimer.remainingSeconds != null
            ? Math.ceil(rideTimer.remainingSeconds / 60)
            : 0
        }
        minHours={1}
        maxHours={8}
      />

      <NoShowPromptModal
        open={Boolean(noShowPrompt)}
        deadline={noShowPrompt?.promptDeadlineAt}
        onYes={() => handleNoShowAnswer('on_my_way')}
        onNo={() => handleNoShowAnswer('not_coming')}
      />
    </div>
  );
};

/* ------------------------------------------------------------------ */

/**
 * Build the body copy for the cancel-confirmation dialog. Branches on
 * the live preview so the user always sees the up-to-date deduction
 * even after a status transition.
 */
function cancelPreviewMessage(preview) {
  if (!preview) return 'Are you sure you want to cancel?';
  const fee = Number(preview.feeCharged) || 0;
  const refund = Number(preview.refundAmount) || 0;
  alert(fee);
  alert(refund);
  if (fee > 0) {
    return refund > 0
      ? `A cancellation fee of \u20B9${fee} will be deducted. You\u2019ll be refunded \u20B9${refund}.`
      : `A cancellation fee of \u20B9${fee} will be deducted.`;
  }
  return preview.tripStarted
    ? 'This trip is in progress. Cancelling now will end the ride.'
    : 'You will not be charged — the driver will be released.';
}

function paymentSummary({ isPaid, isAwaitingPayment, total, payNowAmount }) {
  // `total` here already includes accepted extensions; `payNowAmount`
  // already subtracts whatever the user has paid so far. Together they
  // give the user a single honest number on every status.
  if (isPaid && payNowAmount <= 0) return `Paid · ₹${total}`;
  if (isPaid && payNowAmount > 0) return `Extra due · ₹${payNowAmount}`;
  if (isAwaitingPayment) return `Awaiting payment · ₹${payNowAmount}`;
  return `Total · ₹${total}`;
}

/**
 * `MM:SS` formatter used by the in-ride duration card. Anything past one
 * hour switches to `Hh MMm` so the digits don't get unwieldy.
 */
function formatRideClock(seconds) {
  const total = Math.max(0, Math.floor(seconds || 0));
  if (total >= 3600) {
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  }
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * "Are you coming?" modal. Fires when the driver has been at the
 * pickup past the no-show prompt minutes. Shows a live countdown to
 * the auto-complete deadline so the customer understands the
 * urgency, and forces an explicit Yes / No answer (no overlay-click
 * dismiss — silence is what triggers auto-complete).
 */
function NoShowPromptModal({ open, deadline, onYes, onNo }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!open) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [open]);

  if (!open) return null;

  const remainingMs = deadline
    ? Math.max(0, new Date(deadline).getTime() - now)
    : null;
  const remainingSec = remainingMs != null ? Math.floor(remainingMs / 1000) : null;
  const m = remainingSec != null ? Math.floor(remainingSec / 60) : null;
  const s = remainingSec != null ? remainingSec % 60 : null;
  const countdown =
    remainingSec != null
      ? `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : '—';

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl animate-fade-in-up">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-base font-bold text-text">Are you on your way?</p>
            <p className="text-xs text-text-muted mt-0.5">
              Your driver has been waiting at the pickup.
            </p>
          </div>
        </div>
        <p className="text-sm text-text-secondary leading-snug">
          If you don&rsquo;t respond, the trip will be closed out as a no-show
          and you&rsquo;ll be charged the full fare including the waiting time.
        </p>
        {remainingSec != null && (
          <div className="mt-4 rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-center justify-between">
            <span className="text-xs text-amber-800 font-medium">
              Auto-close in
            </span>
            <span className="text-xl font-bold text-amber-700 tabular-nums">
              {countdown}
            </span>
          </div>
        )}
        <div className="mt-5 flex flex-col gap-2">
          <Button variant="primary" onClick={onYes} className="w-full">
            Yes, I&rsquo;m on my way
          </Button>
          <Button variant="ghost" onClick={onNo} className="w-full">
            No, I&rsquo;m not coming
          </Button>
        </div>
      </div>
    </div>
  );
}

export default DriverAssignedPage;
