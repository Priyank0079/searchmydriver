import { useEffect, useMemo, useRef, useState } from 'react';
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
  ArrowLeft,
  Calendar,
  Car,
} from 'lucide-react';
import Card from '../../../../components/Card';
import Button from '../../../../components/Button';
import PersonContactCard from '../../../../components/PersonContactCard';
import TripTrackingMap from '../../../../components/maps/TripTrackingMap';
import AdsCarousel from '../../../../components/AdsCarousel';
import Avatar from '../../../../components/Avatar';
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
import { SERVICE_TYPES, SERVICE_TYPE_LABELS } from '../../../../constants/serviceTypes';
import { haversineMeters, formatDistance } from '../../../../utils/geo';
import useBookingDraftStore from '../../../../store/user/useBookingDraftStore';
import PaymentChoiceSheet from '../components/PaymentChoiceSheet';
import RideStartOtpCard from '../components/RideStartOtpCard';
import ExtendRideModal from '../components/ExtendRideModal';
import ConfirmDialog from '../../../../components/ConfirmDialog';
import { previewUserCancellation } from '../utils/cancellationPreview';

/** How long the full-size map is shown before it auto-shrinks to the
 * floating preview card. Tuned for "long enough to glance at the driver,
 * short enough to surface promos quickly". */
const MAP_AUTO_COLLAPSE_MS = 7000;

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

  // Always fetch the full booking from the server on mount. The store
  // may already hold a booking object set by createBooking or a socket
  // patch, but those don't include `cancellationPreview.policy` (only
  // the GET /active endpoint hydrates it). Without it the cancel dialog
  // shows stale / zero-fee messages until the user manually reloads.
  const didHydrate = useRef(false);
  useEffect(() => {
    if (didHydrate.current) return;
    didHydrate.current = true;
    fetchActive().catch(() => { });
  }, [fetchActive]);

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

  // Scheduled-ride countdown reminder. The same event is consumed on
  // SearchingDriverPage; here it covers the case where a driver was
  // already assigned (e.g. 15-minute reminder fires while the booking
  // sits in driver_assigned / en_route).
  useSocketEvent(S2C_EVENTS.BOOKING_REMINDER, (payload) => {
    const m = Number(payload?.minutesAhead);
    if (!m) return;
    toast(`Your ride starts in ${m} minutes`, {
      icon: '\u23F0',
      duration: 4000,
    });
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
      fetchWallet().catch(() => { });
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

  // Drivers in this app store their face photo on the `selfie` document
  // captured during onboarding, not in `profilePicture` (which is left
  // blank by the registration flow). We pick the selfie URL first and
  // fall back to `profilePicture` only when present, so the avatars
  // actually render a face instead of grey initials.
  const driverPhotoUrl = useMemo(() => {
    if (!driver) return null;
    const docs = Array.isArray(driver.documents) ? driver.documents : [];
    const selfie = docs.find((d) => d?.type === 'selfie' && d?.fileUrl);
    return selfie?.fileUrl || driver.profilePicture || null;
  }, [driver]);

  const driverCallHref = useMemo(() => {
    const raw = driver?.phone_no || driver?.phone;
    if (!raw) return null;
    return `tel:+91${String(raw).replace(/\D/g, '')}`;
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

  // NOTE: these hooks must live ABOVE the `if (!booking)` early return.
  // Otherwise the first render (booking still loading) calls fewer hooks
  // than the second render (booking arrived), and React throws
  // "Rendered more hooks than during the previous render" — the bug that
  // produced the blank screen on hard refresh.
  const [cancellable, setCancellable] = useState(true);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [mapLocked, setMapLocked] = useState(false);

  const bookingStatusForCancel = booking?.status;
  const arrivedAtForCancel = booking?.timeline?.arrivedAt;
  const freeWaitForCancel = booking?.waiting?.freeMinutes;
  useEffect(() => {
    if (!bookingStatusForCancel) return undefined;
    if (bookingStatusForCancel === BOOKING_STATUS.STARTED) {
      setCancellable(false);
      return undefined;
    }
    if (bookingStatusForCancel === BOOKING_STATUS.ARRIVED && arrivedAtForCancel) {
      const freeWaitMinutes = freeWaitForCancel ?? 15;
      const arrivedAtMs = new Date(arrivedAtForCancel).getTime();

      const checkCancellable = () => {
        const elapsedMinutes = (Date.now() - arrivedAtMs) / 60000;
        setCancellable(elapsedMinutes <= freeWaitMinutes);
      };

      checkCancellable();
      const interval = setInterval(checkCancellable, 10000);
      return () => clearInterval(interval);
    }
    setCancellable(true);
    return undefined;
  }, [bookingStatusForCancel, arrivedAtForCancel, freeWaitForCancel]);

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
  const total = baseTotal + extensionsTotal;
  const amountPaid = booking.payment?.amountPaidRupees || 0;
  const payNowAmount = Math.max(0, total - amountPaid);

  const view = STATUS_VIEW[booking.status] || STATUS_VIEW[BOOKING_STATUS.DRIVER_ASSIGNED];
  const showMap = pickupPoint && booking.status !== BOOKING_STATUS.STARTED;

  /* ─── Status pill color helper ─── */
  const statusPillColor = {
    [BOOKING_STATUS.DRIVER_ASSIGNED]: 'bg-emerald-500',
    [BOOKING_STATUS.AWAITING_PAYMENT]: 'bg-red-500',
    [BOOKING_STATUS.EN_ROUTE]: 'bg-blue-500',
    [BOOKING_STATUS.ARRIVED]: 'bg-amber-500',
    [BOOKING_STATUS.STARTED]: 'bg-sky-500',
    [BOOKING_STATUS.PENDING_ASSIGNMENT]: 'bg-indigo-500',
  }[booking.status] || 'bg-emerald-500';

  return (
    <div className="flex-1 flex flex-col relative bg-gray-950 min-h-dvh overflow-hidden">

      {/* ═══════════════════════════════════════════
          LAYER 1 — Full-screen live map (background)
          ═══════════════════════════════════════════ */}
      {showMap ? (
        <div
          className="absolute inset-0"
          style={{ pointerEvents: mapLocked ? 'none' : 'auto' }}
        >
          <TripTrackingMap
            driver={driverPoint}
            pickup={pickupPoint}
            emphasis="driver"
            height="100%"
            showRoute={booking.status !== BOOKING_STATUS.ARRIVED}
          />
        </div>
      ) : (
        /* Fallback gradient when there's no map (STARTED status) */
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-slate-800 to-gray-900" />
      )}

      {/* ═══════════════════════════════════════════
          LAYER 2 — Floating top bar (always visible)
          ═══════════════════════════════════════════ */}
      <div className="relative z-20 flex items-center justify-between px-4 pt-12 pb-3 pointer-events-auto">
        {/* Back button */}
        <button
          type="button"
          onClick={() => navigate('/user/activity')}
          aria-label="Back to trips"
          className="w-10 h-10 rounded-2xl bg-white/90 backdrop-blur shadow-lg flex items-center justify-center active:scale-90 transition"
        >
          <ArrowLeft className="w-5 h-5 text-gray-800" />
        </button>

        {/* Status chip */}
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full shadow-lg backdrop-blur-sm ${statusPillColor}`}>
          <span className="w-2 h-2 rounded-full bg-white/70 animate-pulse" />
          <span className="text-white text-xs font-bold tracking-wide">{view.title}</span>
        </div>

        {/* Lock map button (only when map is visible) */}
        {showMap && (
          <button
            type="button"
            onClick={() => setMapLocked((v) => !v)}
            aria-label={mapLocked ? 'Unlock map' : 'Lock map'}
            className={`w-10 h-10 rounded-2xl shadow-lg flex items-center justify-center active:scale-90 transition backdrop-blur ${
              mapLocked ? 'bg-primary text-white' : 'bg-white/90 text-gray-600'
            }`}
          >
            {mapLocked ? (
              /* Locked icon */
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3A5.25 5.25 0 0 0 12 1.5Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z" clipRule="evenodd" />
              </svg>
            ) : (
              /* Unlocked icon */
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M18 1.5c2.9 0 5.25 2.35 5.25 5.25v3.75a.75.75 0 0 1-1.5 0V6.75a3.75 3.75 0 1 0-7.5 0v3h.75a3 3 0 0 1 3 3v6.75a3 3 0 0 1-3 3H3.75a3 3 0 0 1-3-3v-6.75a3 3 0 0 1 3-3H15v-3C15 3.85 16.35 1.5 18 1.5Z" />
              </svg>
            )}
          </button>
        )}
      </div>

      {/* ═══════════════════════════════════════════
          LAYER 3 — Driver ETA / distance pill
          (floats mid-screen when map is visible)
          ═══════════════════════════════════════════ */}
      {showMap && liveDriver && distanceMeters != null && booking.status !== BOOKING_STATUS.ARRIVED && (
        <div className="relative z-10 flex justify-center pointer-events-none" style={{ marginTop: 'auto' }}>
          {/* This is absolutely positioned in the middle third of the screen */}
        </div>
      )}

      {/* ═══════════════════════════════════════════
          LAYER 4 — Bottom Sheet (details panel)
          ═══════════════════════════════════════════ */}
      <div className="relative z-20 mt-auto pointer-events-auto">

        {/* ── Ads strip — visible only when sheet is expanded ──
             AdsCarousel renders nothing when no ads are loaded. */}
        {sheetExpanded && (
          <div className="px-4 pb-2">
            <AdsCarousel />
          </div>
        )}

        {/* ── The sheet itself ──
             Split into two zones:
               1. Header (handle + peek row) — never scrolls, always pinned
               2. Body  — scrollable, capped at 72dvh when expanded          */}
        <div className="bg-white rounded-t-[28px] shadow-[0_-8px_32px_rgba(0,0,0,0.18)]">

          {/* Zone 1: sticky header — tap to toggle.
              We render the trigger as a div+role=button (not a <button>)
              so the call CTA inside can stay a real <a href="tel:..">
              without nesting an interactive inside another interactive
              (which Chrome strips and a11y tools flag). */}
          <div
            role="button"
            tabIndex={0}
            aria-label={sheetExpanded ? 'Collapse details' : 'Expand details'}
            onClick={() => setSheetExpanded((v) => !v)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setSheetExpanded((v) => !v);
              }
            }}
            className="w-full px-5 pt-3 pb-4 flex flex-col items-stretch gap-2 focus:outline-none cursor-pointer"
          >
            {/* Drag handle pill */}
            <div className="mx-auto w-10 h-1 rounded-full bg-gray-200" />

            {/* Top meta row: trip-type chip + fare */}
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide bg-primary/10 text-primary-dark px-2.5 py-1 rounded-full">
                <Car className="w-3 h-3" />
                {SERVICE_TYPE_LABELS[booking.serviceType] || booking.serviceType || 'Trip'}
                {booking.hourly?.durationHours
                  ? ` · ${booking.hourly.durationHours}h`
                  : booking.outstation?.days
                    ? ` · ${booking.outstation.days}d`
                    : ''}
              </span>
              <span className="text-sm font-extrabold text-gray-900">
                {'\u20B9'}{total}
              </span>
            </div>

            {/* Collapsed peek row — driver avatar + name + call + chevron */}
            <div className="w-full flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <Avatar
                  src={driverPhotoUrl}
                  name={driver?.name || 'Driver'}
                  size="lg"
                  online={!!liveDriver}
                />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">
                    {driver?.name || 'Assigning driver…'}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {liveDriver
                      ? `${formatDistance(distanceMeters)} away`
                      : booking.status === BOOKING_STATUS.PENDING_ASSIGNMENT
                        ? 'Driver assigned at scheduled time'
                        : 'Locating driver…'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {driverCallHref && (
                  <a
                    href={driverCallHref}
                    onClick={(e) => e.stopPropagation()}
                    aria-label="Call driver"
                    className="w-11 h-11 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-md hover:bg-emerald-600 active:scale-90 transition"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                      <path fillRule="evenodd" d="M1.5 4.5a3 3 0 0 1 3-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 0 1-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 0 0 6.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 0 1 1.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 0 1-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 6.75V4.5Z" clipRule="evenodd" />
                    </svg>
                  </a>
                )}
                <div className={`w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center transition-transform duration-300 ${sheetExpanded ? 'rotate-180' : ''}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-gray-500">
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Zone 2: scrollable body — only rendered (and takes up space) when expanded */}
          {sheetExpanded && (
            <div
              className="overflow-y-auto overscroll-contain"
              style={{ maxHeight: '60dvh' }}
            >
              <div className="px-4 pb-4 space-y-4">

                {/* Booking number & status badge */}
                <div className="bg-gray-50 rounded-2xl px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">Booking ID</p>
                    <p className="text-sm font-bold text-gray-800 font-mono">{booking.bookingNumber}</p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-[11px] font-bold text-white ${statusPillColor}`}>
                    {view.title}
                  </div>
                </div>

                {/* OTP card — moved inside the expanded sheet */}
                {booking.status === BOOKING_STATUS.ARRIVED && booking.rideStartOtp?.code && (
                  <RideStartOtpCard code={booking.rideStartOtp.code} />
                )}

                {/* Driver profile — large photo + rating + call/message */}
                {booking.status !== BOOKING_STATUS.PENDING_ASSIGNMENT && driver && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="bg-gradient-to-br from-primary/10 to-primary/5 px-5 pt-5 pb-4 flex items-center gap-4">
                      <Avatar
                        src={driverPhotoUrl}
                        name={driver?.name || 'Driver'}
                        size="xl"
                        online={!!liveDriver}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-primary-dark font-semibold uppercase tracking-wider mb-0.5">Your Driver</p>
                        <h3 className="text-lg font-extrabold text-gray-900 truncate">{driver?.name || 'Driver'}</h3>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {driver?.rating ? (
                            <span className="inline-flex items-center gap-1 text-sm font-semibold text-gray-700">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-amber-400">
                                <path fillRule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401Z" clipRule="evenodd" />
                              </svg>
                              {Number(driver.rating).toFixed(1)}
                            </span>
                          ) : null}
                          {driver?.experienceYears ? (
                            <span className="text-xs text-gray-500">
                              {Math.round(driver.experienceYears)}+ yrs exp
                            </span>
                          ) : null}
                          {liveDriver ? (
                            <span className="text-xs text-emerald-600 font-medium">
                              · {formatDistance(distanceMeters)} away
                            </span>
                          ) : null}
                        </div>
                        {driverExpertise.length > 0 && (
                          <p className="text-[11px] text-gray-400 mt-1 truncate">
                            Drives: {driverExpertise.join(', ')}
                          </p>
                        )}
                      </div>
                    </div>
                    {(driver?.phone_no || driver?.phone) && (
                      <div className="px-5 py-3 border-t border-gray-100">
                        <a
                          href={`tel:+91${String(driver.phone_no || driver.phone).replace(/\D/g, '')}`}
                          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-50 text-emerald-700 font-semibold text-sm hover:bg-emerald-100 active:scale-95 transition"
                          aria-label="Call driver"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                            <path fillRule="evenodd" d="M1.5 4.5a3 3 0 0 1 3-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 0 1-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 0 0 6.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 0 1 1.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 0 1-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 6.75V4.5Z" clipRule="evenodd" />
                          </svg>
                          Call driver
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {/* Trip details card */}
                <TripDetailsCard booking={booking} />

                {/* In-ride duration tracker */}
                {rideTimer.isStarted && rideTimer.scheduledEndAt && (
                  <Card>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center">
                        <Clock className="w-4 h-4 text-primary-dark" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-text-muted">
                          {rideTimer.remainingSeconds >= 0 ? 'Time remaining' : 'Over booked duration'}
                        </p>
                        <p className={`text-base font-bold ${rideTimer.remainingSeconds < 0 ? 'text-danger' : 'text-text'}`}>
                          {formatRideClock(Math.abs(rideTimer.remainingSeconds))}
                        </p>
                      </div>
                      <Button size="sm" variant="secondary" onClick={() => setExtensionPromptOpen(true)}>
                        Extend ride
                      </Button>
                    </div>
                  </Card>
                )}

                {/* Payment card */}
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

                {/* Cancel button */}
                {cancellable && (
                  <button
                    type="button"
                    disabled={cancelling}
                    onClick={handleCancel}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 text-red-600 font-semibold py-3 text-sm disabled:opacity-60 hover:bg-red-100 transition"
                  >
                    <X className="w-4 h-4" />
                    {cancelling ? 'Cancelling…' : 'Cancel booking'}
                  </button>
                )}

                {/* Safe-area bottom padding */}
                <div className="h-2" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Modals / overlays (logic unchanged) ─── */}
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

      <PaymentChoiceSheet
        open={isAwaitingPayment && !isPaid}
        onClose={() => { /* sheet only closes via successful payment / status change */ }}
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
 * Rich trip-detail card shown right under the driver/contact strip.
 * Surfaces the bits the user usually scrolls back up to double-check:
 * service type, duration (hours / days), scheduled pickup time, the
 * car they registered, and the pickup / destination addresses.
 */
function TripDetailsCard({ booking }) {
  const serviceLabel =
    SERVICE_TYPE_LABELS[booking.serviceType] || booking.serviceType || 'Trip';

  const durationLabel = (() => {
    if (booking.hourly?.durationHours) {
      const h = booking.hourly.durationHours;
      return `${h} hour${h > 1 ? 's' : ''}`;
    }
    if (booking.outstation?.days) {
      const d = booking.outstation.days;
      return `${d} day${d > 1 ? 's' : ''}`;
    }
    return null;
  })();

  const scheduledAt =
    booking.hourly?.scheduledStartAt ||
    booking.outstation?.startDate ||
    booking.timeline?.scheduledFor ||
    null;
  const scheduledLabel = scheduledAt
    ? new Date(scheduledAt).toLocaleString('en-IN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    : null;

  const car = booking.carId || booking.car;
  const carLabel = (() => {
    if (!car) return null;
    const parts = [car.brandName || car.brand, car.modelName || car.model]
      .filter(Boolean)
      .join(' ');
    const plate = car.registrationNumber || car.numberPlate;
    if (parts && plate) return `${parts} · ${plate}`;
    return parts || plate || null;
  })();

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text">Trip details</h3>
        <span className="text-[11px] font-semibold uppercase tracking-wide bg-primary/10 text-primary-dark px-2 py-0.5 rounded-full">
          {serviceLabel}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        {durationLabel && (
          <DetailTile
            icon={<Clock className="w-4 h-4 text-primary-dark" />}
            label="Duration"
            value={durationLabel}
          />
        )}
        {scheduledLabel && (
          <DetailTile
            icon={<Calendar className="w-4 h-4 text-primary-dark" />}
            label="Scheduled"
            value={scheduledLabel}
          />
        )}
        {carLabel && (
          <DetailTile
            icon={<Car className="w-4 h-4 text-primary-dark" />}
            label="Your car"
            value={carLabel}
            full={!durationLabel || !scheduledLabel}
          />
        )}
      </div>

      <div className="border-t border-border-light pt-3 space-y-3">
        <div className="flex items-start gap-3">
          <MapPin className="w-4 h-4 text-success mt-1 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs text-text-muted">Pickup</p>
            <p className="text-sm font-medium text-text break-words">
              {booking.pickup?.address}
            </p>
          </div>
        </div>
        {booking.outstation?.destinationAddress && (
          <div className="flex items-start gap-3">
            <MapPin className="w-4 h-4 text-danger mt-1 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-text-muted">Destination</p>
              <p className="text-sm font-medium text-text break-words">
                {booking.outstation.destinationAddress}
              </p>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function DetailTile({ icon, label, value, full }) {
  return (
    <div
      className={`rounded-xl bg-gray-50 border border-border-light px-3 py-2 ${full ? 'col-span-2' : ''
        }`}
    >
      <div className="flex items-center gap-2 mb-0.5">
        {icon}
        <p className="text-[11px] text-text-muted">{label}</p>
      </div>
      <p className="text-sm font-semibold text-text break-words">{value}</p>
    </div>
  );
}

/**
 * Build the body copy for the cancel-confirmation dialog. Branches on
 * the live preview so the user always sees the up-to-date deduction
 * even after a status transition.
 */
function cancelPreviewMessage(preview) {
  if (!preview) return 'Are you sure you want to cancel?';
  const fee = Number(preview.feeCharged) || 0;
  const refund = Number(preview.refundAmount) || 0;

  // Trip already started — override everything.
  if (preview.tripStarted) {
    if (fee > 0) {
      const parts = [`This trip is in progress. A cancellation fee of \u20B9${fee} will be deducted.`];
      if (refund > 0) parts.push(`You\u2019ll be refunded \u20B9${refund}.`);
      return parts.join(' ');
    }
    return 'This trip is in progress. Cancelling now will end the ride.';
  }

  // Driver has reached pickup.
  if (preview.driverArrived) {
    if (fee > 0) {
      const parts = [`The driver has arrived at the pickup location. A cancellation fee of \u20B9${fee} will be deducted.`];
      if (refund > 0) parts.push(`You\u2019ll be refunded \u20B9${refund}.`);
      return parts.join(' ');
    }
    return 'The driver has arrived at the pickup. You can cancel, but a fee may apply once processed.';
  }

  // Driver assigned / en route (pre-arrival).
  if (fee > 0) {
    const parts = [`The driver is already assigned and on the way. A cancellation fee of \u20B9${fee} will be deducted.`];
    if (refund > 0) parts.push(`You\u2019ll be refunded \u20B9${refund}.`);
    return parts.join(' ');
  }

  return 'No cancellation fee will be charged. The driver will be released.';
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
