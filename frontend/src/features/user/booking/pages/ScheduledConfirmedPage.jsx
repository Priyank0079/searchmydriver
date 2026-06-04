import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  CalendarClock,
  Clock,
  MapPin,
  Sparkles,
  X,
  LifeBuoy,
  ShieldCheck,
  Loader2,
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
import { previewUserCancellation } from '../utils/cancellationPreview';
import { formatPickupDateTime } from '../../../../utils/datetime';

/**
 * The "your ride is locked in" screen for scheduled hourly bookings that
 * sit in `PENDING_ASSIGNMENT` (long-lead tier — searching for a driver
 * only starts `LONG_LEAD_HOURS` before pickup) or `IN_EMERGENCY_POOL`
 * (no driver was found inside the auto window, an admin is being asked
 * to assign one).
 *
 * Behaviour:
 *
 *   - Counts down to either `scheduled.assignAt` (search start) or
 *     `hourly.scheduledStartAt` (pickup) — whichever comes first.
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
  const paymentMethod = booking?.paymentMethod;
  useEffect(() => {
    if (!bookingStatus) return;
    switch (bookingStatus) {
      case BOOKING_STATUS.SEARCHING:
        navigate('/user/book/searching', { replace: true });
        break;
      case BOOKING_STATUS.DRIVER_ASSIGNED:
        navigate('/user/book/assigned', { replace: true });
        break;
      case BOOKING_STATUS.AWAITING_PAYMENT:
        if (paymentMethod === 'wallet') {
          navigate('/user/book/assigned', { replace: true });
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
  }, [bookingStatus, paymentMethod, navigate, clearActiveBooking, fetchWallet]);

  const pickupAt = booking?.hourly?.scheduledStartAt
    ? new Date(booking.hourly.scheduledStartAt)
    : null;
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

        <Card>
          <div className="space-y-3">
            <Row
              icon={CalendarClock}
              label="Pickup time"
              value={formatPickupDateTime(pickupAt)}
            />
            <Row
              icon={Clock}
              label="Duration"
              value={`${booking.hourly?.durationHours || 0} hour${
                (booking.hourly?.durationHours || 0) === 1 ? '' : 's'
              }`}
            />
            <Row
              icon={MapPin}
              label="Pickup"
              value={booking.pickup?.address || '—'}
              multiline
            />
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
        <Button
          variant="ghost"
          fullWidth
          icon={X}
          onClick={() => setCancelOpen(true)}
        >
          Cancel scheduled ride
        </Button>
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
