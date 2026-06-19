import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  CalendarClock,
  Calendar,
  Clock,
  MapPin,
  Mountain,
  Navigation,
  Sparkles,
  X,
  LifeBuoy,
  ShieldCheck,
  Loader2,
  Wallet as WalletIcon,
  HandCoins,
  Car as CarIcon,
} from 'lucide-react';
import Card from '../../../../components/Card';
import Button from '../../../../components/Button';
import ConfirmDialog from '../../../../components/ConfirmDialog';
import { useSocketEvent } from '../../../../hooks/useSocket';
import { S2C_EVENTS } from '../../../../constants/socketEvents';
import useUserActiveBookingStore from '../../../../store/user/useUserActiveBookingStore';
import useUserWalletStore from '../../../../store/user/useUserWalletStore';
import useBookingDraftStore from '../../../../store/user/useBookingDraftStore';
import { BOOKING_STATUS } from '../../../../constants/bookingStatus';
import { SERVICE_TYPES } from '../../../../constants/serviceTypes';
import { previewUserCancellation } from '../utils/cancellationPreview';
import { formatPickupDateTime } from '../../../../utils/datetime';
import { getCarBrandName, getCarModelName } from '../../../../utils/vehicleCatalog';

/**
 * The "your ride is locked in" screen for scheduled bookings that sit
 * in `PENDING_ASSIGNMENT` (long-lead tier — searching for a driver only
 * starts `LONG_LEAD_HOURS` before pickup) or `IN_EMERGENCY_POOL` (no
 * driver was found inside the auto window, an admin is being asked to
 * assign one).
 *
 * Supports both hourly and outstation services — the trip-details card
 * branches on `serviceType` so an outstation customer sees their
 * pickup datetime + expected return + days × nights + destination,
 * while an hourly customer sees their booked duration. Outstation
 * trips also surface the food/stay arrangement the customer locked
 * in on the confirm screen, plus the same fare-summary + vehicle
 * card every detail page in the app shares.
 *
 * Behaviour:
 *
 *   - Counts down to either `scheduled.assignAt` (search start) or
 *     the booking's pickup time — whichever comes first.
 *   - Re-routes automatically on socket patches: once the status flips
 *     to SEARCHING / DRIVER_ASSIGNED / AWAITING_PAYMENT we forward the
 *     user to the matching screen so they never get stranded here.
 *   - Cancellation works exactly like the standard "during search"
 *     flow — the backend refunds to the wallet and drops the queued
 *     `assign` + `escalate` jobs.
 */
const ScheduledConfirmedPage = () => {
  const navigate = useNavigate();
  const booking = useUserActiveBookingStore((s) => s.booking);
  const fetchActive = useUserActiveBookingStore((s) => s.fetchActive);
  const applyUpdate = useUserActiveBookingStore((s) => s.applyUpdate);
  const cancelBooking = useUserActiveBookingStore((s) => s.cancelBooking);
  const clearActiveBooking = useUserActiveBookingStore((s) => s.clear);
  const fetchWallet = useUserWalletStore((s) => s.fetchWallet);
  const draftReset = useBookingDraftStore((s) => s.reset);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Hydrate if the user landed here directly via URL (refresh / deep link).
  useEffect(() => {
    if (!booking) {
      fetchActive().catch(() => {});
    }
  }, [booking, fetchActive]);

  // Live patches — same firehose every other booking page subscribes to.
  useSocketEvent(S2C_EVENTS.BOOKING_UPDATED, (payload) => {
    applyUpdate(payload);
  });

  // Status-driven redirects. Mirror of the SearchingDriverPage table.
  const bookingStatus = booking?.status;
  const bookingIdForRedirect = booking?._id;
  const paymentMethod = booking?.paymentMethod;
  useEffect(() => {
    if (!bookingStatus) return;
    const assignedRoute = bookingIdForRedirect
      ? `/user/book/assigned/${bookingIdForRedirect}`
      : '/user/book/assigned';
    switch (bookingStatus) {
      case BOOKING_STATUS.SEARCHING:
        navigate('/user/book/searching', { replace: true });
        break;
      case BOOKING_STATUS.DRIVER_ASSIGNED:
        navigate(assignedRoute, { replace: true });
        break;
      case BOOKING_STATUS.AWAITING_PAYMENT:
        if (paymentMethod === 'wallet') {
          navigate(assignedRoute, { replace: true });
        } else {
          navigate('/user/book/payment', { replace: true });
        }
        break;
      case BOOKING_STATUS.CANCELLED:
        fetchWallet().catch(() => {});
        navigate('/user/home', { replace: true });
        break;
      case BOOKING_STATUS.NO_DRIVERS_FOUND:
        clearActiveBooking();
        fetchWallet().catch(() => {});
        navigate('/user/home', { replace: true });
        break;
      default:
        break;
    }
  }, [bookingStatus, bookingIdForRedirect, paymentMethod, navigate, clearActiveBooking, fetchWallet]);

  const isOutstation = booking?.serviceType === SERVICE_TYPES.OUTSTATION;
  // For hourly the scheduled start lives on `hourly.scheduledStartAt`;
  // outstation uses `outstation.pickupAt` (newer) and falls back to the
  // legacy `outstation.startDate` field for older bookings.
  const pickupAt = useMemo(() => {
    const raw = isOutstation
      ? booking?.outstation?.pickupAt || booking?.outstation?.startDate
      : booking?.hourly?.scheduledStartAt;
    return raw ? new Date(raw) : null;
  }, [isOutstation, booking]);
  const expectedReturnAt = useMemo(() => {
    if (!isOutstation) return null;
    const raw = booking?.outstation?.expectedReturnAt
      || booking?.outstation?.endDate;
    return raw ? new Date(raw) : null;
  }, [isOutstation, booking]);
  const assignAt = booking?.scheduled?.assignAt
    ? new Date(booking.scheduled.assignAt)
    : null;
  const escalateAt = booking?.scheduled?.escalateAt
    ? new Date(booking.scheduled.escalateAt)
    : null;

  const inPool = bookingStatus === BOOKING_STATUS.IN_EMERGENCY_POOL;
  // Pick the most informative countdown target:
  //   PENDING_ASSIGNMENT (long-lead) → counts down to `assignAt`
  //   IN_EMERGENCY_POOL              → counts down to pickup
  //   anything else hits a redirect above before we render
  const countdownTo = inPool ? pickupAt : assignAt || pickupAt;

  const handleCancel = async () => {
    if (cancelling) return;
    setCancelling(true);
    try {
      await cancelBooking('cancelled_by_user');
      fetchWallet().catch(() => {});
      draftReset();
      navigate('/user/home', { replace: true });
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not cancel');
    } finally {
      setCancelling(false);
    }
  };

  const cancellationPreview = useMemo(
    () => (booking ? previewUserCancellation(booking) : null),
    [booking],
  );

  if (!booking) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bg">
        <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-bg">
      <div className="bg-white px-4 pt-5 pb-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
              inPool ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'
            }`}
          >
            {inPool ? <LifeBuoy className="w-5 h-5" /> : <CalendarClock className="w-5 h-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-text">
              {inPool ? 'Finding you a driver' : 'Ride scheduled'}
            </h1>
            <p className="text-xs text-text-muted">
              {inPool
                ? 'Our team is assigning a driver manually — hold tight.'
                : `Booking ${booking.bookingNumber || ''}`}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-4">
        <CountdownCard target={countdownTo} mode={inPool ? 'pickup' : 'assign'} />

        {/* Trip details — branches on service type because outstation
            captures destination/return date/days/nights that hourly
            doesn't, and hourly captures booked duration that outstation
            doesn't. */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-text">Trip details</h3>
            <span className="text-[11px] font-semibold uppercase tracking-wide bg-primary/10 text-primary-dark px-2 py-0.5 rounded-full inline-flex items-center gap-1">
              {isOutstation ? (
                <>
                  <Mountain className="w-3 h-3" />
                  Outstation
                </>
              ) : (
                <>
                  <Clock className="w-3 h-3" />
                  Hourly
                </>
              )}
            </span>
          </div>
          <div className="space-y-3">
            <Row
              icon={CalendarClock}
              label={isOutstation ? 'Pickup date & time' : 'Pickup time'}
              value={formatPickupDateTime(pickupAt)}
            />
            {isOutstation ? (
              <>
                <Row
                  icon={Calendar}
                  label="Expected return"
                  value={formatPickupDateTime(expectedReturnAt)}
                />
                <Row
                  icon={Clock}
                  label="Trip length"
                  value={`${booking.outstation?.days || 1} day${(booking.outstation?.days || 1) === 1 ? '' : 's'} \u00b7 ${booking.outstation?.nights || 0} night${(booking.outstation?.nights || 0) === 1 ? '' : 's'}`}
                />
              </>
            ) : (
              <Row
                icon={Clock}
                label="Duration"
                value={`${booking.hourly?.durationHours || 0} hour${
                  (booking.hourly?.durationHours || 0) === 1 ? '' : 's'
                }`}
              />
            )}
            <Row
              icon={MapPin}
              label="Pickup"
              value={booking.pickup?.address || '\u2014'}
              multiline
            />
            {isOutstation
              && (booking.outstation?.destinationAddress
                || booking.dropoff?.address) && (
              <Row
                icon={Navigation}
                label="Destination"
                value={
                  booking.outstation?.destinationAddress
                  || booking.dropoff?.address
                }
                multiline
                hint="Round trip \u2014 the driver brings you back here."
              />
            )}
            {!inPool && assignAt && (
              <Row
                icon={Sparkles}
                label="Driver search starts"
                value={formatPickupDateTime(assignAt)}
                hint="We start looking a few hours before pickup so the closest, best-rated driver gets your ride."
              />
            )}
            {!inPool && escalateAt && (
              <Row
                icon={ShieldCheck}
                label="Backup window"
                value={formatPickupDateTime(escalateAt)}
                hint="If we still don't have a driver by then, our team takes over and assigns one manually."
              />
            )}
          </div>
        </Card>

        {/* Driver food + stay arrangement — outstation only. Mirrors
            the toggles the customer flipped on the confirm screen so
            they can verify their choice is locked in before the
            search starts. `needsFood`/`needsStay` carry the same
            semantic as the engine's `foodProvided`/`stayProvided`
            flags — `true` = customer is arranging it (no allowance
            charge), `false` = company pays the allowance. */}
        {isOutstation && (
          <FoodStayChip
            needsFood={booking.outstation?.needsFood}
            needsStay={booking.outstation?.needsStay}
            nights={booking.outstation?.nights || 0}
          />
        )}

        {/* Vehicle — the customer's own car the driver will operate.
            Populated when the booking-detail endpoint resolves the
            nested catalog refs. */}
        {booking.carId && typeof booking.carId === 'object' && (
          <VehicleCard car={booking.carId} />
        )}

        {/* Fare summary — what's been collected from the wallet plus
            any refundable waiting reserve. The full breakdown is on
            /user/trips/:id; this is the at-a-glance number the
            customer cares about while they wait. */}
        <FareSummaryCard booking={booking} />

        {inPool ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <LifeBuoy className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-amber-900">
                Manual assignment in progress
              </p>
              <p className="text-[12px] text-amber-800 leading-snug mt-0.5">
                Drivers in your area are booked, so our operations team is
                hand-picking one for you. The instant they accept, the ride
                appears here.
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-emerald-900">Payment held safely</p>
              <p className="text-[12px] text-emerald-800 leading-snug mt-0.5">
                {`\u20B9`}{Number(booking?.payment?.amountPaidRupees || 0)}{' '}
                is held in your wallet. Cancel any time before the driver
                heads over and you get a full refund.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white border-t border-border-light px-4 py-3">
        <button
          type="button"
          disabled={cancelling}
          onClick={() => setCancelOpen(true)}
          className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 text-red-600 font-semibold py-3 text-sm disabled:opacity-60 hover:bg-red-100 transition"
        >
          <X className="w-4 h-4" />
          {cancelling ? 'Cancelling…' : 'Cancel scheduled ride'}
        </button>
      </div>

      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={handleCancel}
        loading={cancelling}
        title="Cancel scheduled ride?"
        description={
          cancellationPreview?.feeCharged > 0
            ? `A \u20B9${cancellationPreview.feeCharged} cancellation fee will be deducted. The rest (${`\u20B9${cancellationPreview.refundAmount}`}) goes back to your wallet.`
            : 'Your full payment will be refunded to your wallet.'
        }
        confirmLabel="Cancel ride"
        cancelLabel="Keep ride"
        variant="danger"
      />
    </div>
  );
};

/* ------------------------------------------------------------------ */

function FoodStayChip({ needsFood, needsStay, nights = 0 }) {
  // `needsFood === true` / `needsStay === true` mean the customer is
  // arranging that piece themselves (matches the backend mapping
  // `foodProvided: outstation?.needsFood ?? true`). Anything else
  // (`false`/null) means the allowance is included in the fare.
  // For same-day trips (nights === 0) the stay toggle is irrelevant
  // — we collapse the messaging accordingly.
  const customerArrangingFood = needsFood === true;
  const customerArrangingStay = needsStay === true;
  const stayApplicable = nights > 0;
  let title;
  let body;
  let tone;
  if (customerArrangingFood && (customerArrangingStay || !stayApplicable)) {
    title = stayApplicable
      ? 'You\u2019re covering the driver\u2019s food & stay'
      : 'You\u2019re covering the driver\u2019s food';
    body = 'No food/stay allowance will be charged on top of your fare.';
    tone = 'emerald';
  } else if (customerArrangingFood) {
    title = 'You\u2019re covering the driver\u2019s food';
    body = 'Stay allowance is included in your fare; you\u2019ll arrange meals.';
    tone = 'amber';
  } else if (customerArrangingStay && stayApplicable) {
    title = 'You\u2019re covering the driver\u2019s stay';
    body = 'Food allowance is included in your fare; you\u2019ll arrange lodging.';
    tone = 'amber';
  } else {
    title = stayApplicable
      ? 'Food & stay allowance included'
      : 'Food allowance included';
    body = stayApplicable
      ? 'Your fare already covers the driver\u2019s meals and lodging on this trip.'
      : 'Your fare already covers the driver\u2019s meals on this trip.';
    tone = 'indigo';
  }
  const palette = {
    emerald: {
      bg: 'bg-emerald-50 border-emerald-200',
      iconBg: 'bg-emerald-100 text-emerald-700',
      title: 'text-emerald-900',
      body: 'text-emerald-800',
    },
    amber: {
      bg: 'bg-amber-50 border-amber-200',
      iconBg: 'bg-amber-100 text-amber-700',
      title: 'text-amber-900',
      body: 'text-amber-800',
    },
    indigo: {
      bg: 'bg-indigo-50 border-indigo-200',
      iconBg: 'bg-indigo-100 text-indigo-700',
      title: 'text-indigo-900',
      body: 'text-indigo-800',
    },
  }[tone];
  return (
    <div className={`rounded-2xl border p-3 flex items-start gap-3 ${palette.bg}`}>
      <div
        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${palette.iconBg}`}
      >
        <HandCoins className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className={`text-sm font-bold ${palette.title}`}>{title}</p>
        <p className={`text-[12px] leading-snug mt-0.5 ${palette.body}`}>{body}</p>
      </div>
    </div>
  );
}

function VehicleCard({ car }) {
  const title = `${getCarBrandName(car)} \u00b7 ${getCarModelName(car)}`;
  const transmission = car?.transmission || null;
  const fuel = car?.fuelTypeId?.name || null;
  const carType = car?.carTypeId?.name || null;
  const plate = car?.vehicleNumber || null;
  const meta = [carType, transmission, fuel].filter(Boolean).join(' \u00b7 ');
  return (
    <Card>
      <p className="text-[11px] uppercase tracking-wide text-text-muted font-semibold mb-3">
        Your vehicle
      </p>
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 overflow-hidden">
          {car?.image ? (
            <img src={car.image} alt={title} className="w-full h-full object-cover" />
          ) : (
            <CarIcon className="w-5 h-5" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text truncate">{title}</p>
          {meta && (
            <p className="text-[12px] text-text-muted truncate">{meta}</p>
          )}
        </div>
        {plate && (
          <span className="text-[11px] font-mono font-semibold uppercase tracking-wide bg-slate-100 text-slate-700 px-2 py-1 rounded-md">
            {plate}
          </span>
        )}
      </div>
    </Card>
  );
}

function FareSummaryCard({ booking }) {
  const total = Number(booking?.fareSnapshot?.total || 0);
  const paid = Number(booking?.payment?.amountPaidRupees || 0);
  const buffer = Number(booking?.waiting?.bufferRupees || 0);
  // Outstation is multi-day so the daily/food/stay breakdown is worth
  // surfacing inline. Hourly is fine with just the total — the rest of
  // its math (hourly slab, GST, service charge) lives on the receipt.
  const breakdown = booking?.fareSnapshot?.breakdown || {};
  const isOutstation = booking?.serviceType === SERVICE_TYPES.OUTSTATION;
  const rows = [];
  if (isOutstation) {
    if (Number(breakdown.dailyRateTotal) > 0) {
      rows.push({
        label: `Daily rate \u00d7 ${breakdown.days || booking?.outstation?.days || 1}`,
        value: breakdown.dailyRateTotal,
      });
    }
    if (Number(breakdown.foodAllowanceTotal) > 0) {
      rows.push({
        label: `Driver food \u00d7 ${breakdown.days || booking?.outstation?.days || 1}`,
        value: breakdown.foodAllowanceTotal,
      });
    }
    if (Number(breakdown.stayAllowanceTotal) > 0) {
      rows.push({
        label: `Driver stay \u00d7 ${breakdown.nights || booking?.outstation?.nights || 0}`,
        value: breakdown.stayAllowanceTotal,
      });
    }
    if (Number(breakdown.legacyAllowanceTotal) > 0) {
      rows.push({
        label: `Driver allowance \u00d7 ${breakdown.nights || booking?.outstation?.nights || 0}`,
        value: breakdown.legacyAllowanceTotal,
      });
    }
  }
  if (Number(breakdown.serviceCharge) > 0) {
    rows.push({ label: 'Service charge', value: breakdown.serviceCharge });
  }
  if (Number(breakdown.gst) > 0) {
    rows.push({ label: 'GST', value: breakdown.gst });
  }
  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] uppercase tracking-wide text-text-muted font-semibold">
          Fare
        </p>
        <span className="text-[11px] text-text-muted">
          {booking?.paymentMethod === 'wallet' ? 'Paid from wallet' : 'Paid'}
        </span>
      </div>
      {rows.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between text-[12px]"
            >
              <span className="text-text-muted">{row.label}</span>
              <span className="text-text font-medium tabular-nums">
                {`\u20B9${Number(row.value || 0).toLocaleString('en-IN')}`}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between pt-2 border-t border-border-light">
        <span className="text-sm font-semibold text-text">Total held</span>
        <span className="text-base font-bold text-text tabular-nums">
          {`\u20B9${Math.max(total, paid).toLocaleString('en-IN')}`}
        </span>
      </div>
      {buffer > 0 && (
        <div className="mt-2 flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2">
          <WalletIcon className="w-3.5 h-3.5 mt-0.5 text-slate-500 shrink-0" />
          <p className="text-[11px] text-slate-700 leading-snug">
            <strong>{`\u20B9${buffer.toLocaleString('en-IN')}`}</strong>{' '}
            is reserved as a waiting buffer. We&apos;ll refund any unused
            portion to your wallet after the trip.
          </p>
        </div>
      )}
    </Card>
  );
}

function Row({ icon: Icon, label, value, multiline = false, hint = null }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-text-muted uppercase tracking-wide">{label}</p>
        <p
          className={`text-sm font-semibold text-text ${
            multiline ? 'break-words' : 'truncate'
          }`}
        >
          {value}
        </p>
        {hint && (
          <p className="text-[11px] text-text-muted leading-snug mt-1">{hint}</p>
        )}
      </div>
    </div>
  );
}

/**
 * Lightweight live countdown. Re-renders every second; switches its
 * copy and tone depending on whether we're counting to the driver
 * search starting or to pickup itself.
 */
function CountdownCard({ target, mode }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!target) {
    return (
      <Card>
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
          <p className="text-sm text-text-muted">Working on the schedule…</p>
        </div>
      </Card>
    );
  }

  const diffMs = target.getTime() - now;
  const negative = diffMs <= 0;
  const seconds = Math.max(0, Math.floor(Math.abs(diffMs) / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const compact =
    h > 0
      ? `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
      : `${m}m ${String(s).padStart(2, '0')}s`;

  const accent =
    mode === 'pickup'
      ? 'from-amber-500 to-orange-500'
      : 'from-indigo-600 to-violet-600';
  const caption = negative
    ? mode === 'pickup'
      ? 'Pickup time has arrived'
      : 'Starting driver search now'
    : mode === 'pickup'
      ? 'Until your pickup time'
      : 'Until we start searching for a driver';

  return (
    <div
      className={`rounded-3xl overflow-hidden bg-gradient-to-br ${accent} text-white p-5 shadow-sm`}
    >
      <p className="text-[11px] uppercase tracking-wide text-white/70">
        {caption}
      </p>
      <p className="text-3xl font-bold mt-1 tabular-nums">{compact}</p>
      <p className="text-[12px] text-white/80 mt-1">
        We&apos;ll notify you the moment something changes.
      </p>
    </div>
  );
}

export default ScheduledConfirmedPage;
