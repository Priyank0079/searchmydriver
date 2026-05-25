import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  CreditCard,
  Shield,
  Loader2,
  Timer,
  AlertTriangle,
} from 'lucide-react';
import useUserActiveBookingStore from '../../../../store/user/useUserActiveBookingStore';
import { useRazorpayCheckout } from '../../../../hooks/useRazorpayCheckout';
import { PAYMENT_POLICY } from '../../../../constants/bookingStatus';
import ConfirmDialog from '../../../../components/ConfirmDialog';

/**
 * Pay-first sheet shown after a driver accepts the booking.
 *
 * The pay-after-the-ride option has been removed entirely: once a driver
 * accepts, the customer has exactly `PAYMENT_POLICY.PAYMENT_DEADLINE_SECONDS`
 * to complete payment via Razorpay or the booking auto-cancels server-side
 * (which also releases the driver back to the dispatcher).
 *
 *   props:
 *     - open      controlled boolean (parent drives visibility based on
 *                 booking.status === AWAITING_PAYMENT)
 *     - onClose   () => void — informational; the sheet is dismiss-proof
 *                 while the deadline timer runs, so this only fires on
 *                 successful payment / external state change
 *     - booking   the active booking (we read fareSnapshot + timeline from
 *                 here to drive the countdown)
 *
 * The sheet is intentionally NOT dismissible by clicking the backdrop —
 * the user has only two ways out: pay successfully, or wait for the
 * server-side auto-cancel.
 */
const PaymentChoiceSheet = ({ open, onClose, booking }) => {
  const createPaymentOrder = useUserActiveBookingStore((s) => s.createPaymentOrder);
  const verifyPayment = useUserActiveBookingStore((s) => s.verifyPayment);
  const cancelBooking = useUserActiveBookingStore((s) => s.cancelBooking);
  const { openCheckout, loading: checkoutLoading } = useRazorpayCheckout();

  const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  // Razorpay's modal is layered above us; we keep one in-flight call
  // tracked so a freshly-opened sheet (after a socket re-render) doesn't
  // double-fire Razorpay.
  const checkoutInFlightRef = useRef(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- canonical reset on close
    if (!open) setBusy(false);
  }, [open]);

  // Tick once per second while open so the deadline countdown stays live.
  useEffect(() => {
    if (!open) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [open]);

  const total = booking?.fareSnapshot?.total || 0;

  // Deadline countdown. We prefer the server-stamped `paymentDeadlineAt`
  // because it gets refreshed every time the user clicks Pay Now (retry-
  // extends-the-clock behaviour). Older bookings that pre-date the field
  // fall back to `driverAssignedAt + PAYMENT_DEADLINE_SECONDS` so the
  // legacy flow still ticks correctly.
  const { remainingSec, expired } = useMemo(() => {
    const explicitDeadline = booking?.timeline?.paymentDeadlineAt;
    const assignedAt = booking?.timeline?.driverAssignedAt;
    const deadlineMs = explicitDeadline
      ? new Date(explicitDeadline).getTime()
      : assignedAt
        ? new Date(assignedAt).getTime() +
          PAYMENT_POLICY.PAYMENT_DEADLINE_SECONDS * 1000
        : null;
    if (!deadlineMs) {
      return { remainingSec: PAYMENT_POLICY.PAYMENT_DEADLINE_SECONDS, expired: false };
    }
    const remaining = Math.max(0, (deadlineMs - now) / 1000);
    return {
      remainingSec: Math.ceil(remaining),
      expired: remaining <= 0,
    };
  }, [
    booking?.timeline?.paymentDeadlineAt,
    booking?.timeline?.driverAssignedAt,
    now,
  ]);

  const handlePayNow = useCallback(async () => {
    if (busy || checkoutInFlightRef.current) return;
    checkoutInFlightRef.current = true;
    setBusy(true);
    try {
      // Backend has already parked the booking in `awaiting_payment` the
      // moment the driver accepted — no mode-switch call is required.
      const order = await createPaymentOrder();
      if (!order?.orderId) {
        toast.error('Payments are not configured. Please try again later.');
        return;
      }
      await openCheckout({
        razorpay: {
          keyId: order.keyId,
          orderId: order.orderId,
          amount: order.amount,
          currency: order.currency,
          name: order.name,
          description: order.description,
        },
        order: { _id: order.bookingId },
        onSuccess: async (response) => {
          await verifyPayment({
            orderId: response.razorpay_order_id,
            paymentId: response.razorpay_payment_id,
            signature: response.razorpay_signature,
          });
        },
      });
      toast.success('Payment successful');
      onClose?.();
    } catch (err) {
      // Razorpay was dismissed or failed. We deliberately do NOT cancel
      // the booking here — the user has whatever time is left on the
      // deadline to retry. Once the deadline elapses the server auto-
      // cancels and emits a BOOKING_UPDATED patch.
      if (err?.message === 'Payment cancelled') {
        toast(`Payment cancelled — you can retry before the timer runs out`, {
          icon: '⌛',
        });
      } else {
        toast.error(err?.response?.data?.message || err?.message || 'Payment failed');
      }
    } finally {
      setBusy(false);
      checkoutInFlightRef.current = false;
    }
  }, [busy, createPaymentOrder, openCheckout, verifyPayment, onClose]);

  const handleCancelRequest = useCallback(() => {
    if (cancelling || busy) return;
    setConfirmOpen(true);
  }, [busy, cancelling]);

  const handleCancelConfirm = useCallback(async () => {
    setCancelling(true);
    try {
      await cancelBooking('cancelled_before_payment');
      toast('Booking cancelled — no charge.', { icon: '\u2713' });
      setConfirmOpen(false);
      onClose?.();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Could not cancel');
    } finally {
      setCancelling(false);
    }
  }, [cancelBooking, onClose]);

  if (!open) return null;

  const minutes = Math.floor(remainingSec / 60);
  const seconds = String(remainingSec % 60).padStart(2, '0');
  const countdownLabel = `${minutes}:${seconds}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop is intentionally non-dismissive — the user must pay or wait. */}
      <div className="absolute inset-0 bg-black/60" />

      <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 pb-6 animate-slide-up">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-100">
              <Timer className="w-3.5 h-3.5 text-amber-700" />
            </span>
            <h2 className="text-lg font-bold text-text">Pay to confirm your ride</h2>
          </div>
          <p className="text-xs text-text-muted">
            Your driver is waiting. Complete payment within the time limit
            below or the booking will be cancelled automatically.
          </p>
        </div>

        {/* Deadline strip — red as we approach zero so the urgency is obvious. */}
        <div
          className={`mb-4 flex items-center justify-between gap-2 px-3 py-2 rounded-2xl border ${
            expired
              ? 'bg-red-50 border-red-200'
              : remainingSec <= 20
                ? 'bg-red-50 border-red-200'
                : 'bg-amber-50 border-amber-200'
          }`}
        >
          <div
            className={`flex items-center gap-2 ${
              expired || remainingSec <= 20 ? 'text-red-700' : 'text-amber-800'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="text-[12px] font-semibold">
              {expired
                ? 'Time’s up — cancelling booking…'
                : `Pay within ${countdownLabel}`}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-primary bg-primary/5 p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <CreditCard className="w-5 h-5 text-amber-700" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-text">Pay now</p>
            <p className="text-xs text-text-muted mt-0.5">
              Pay via UPI, card, wallet or netbanking — secured by Razorpay.
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-base font-bold text-text">₹{total}</p>
          </div>
        </div>

        <button
          type="button"
          disabled={busy || checkoutLoading || expired || cancelling}
          onClick={handlePayNow}
          className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-primary text-white font-bold py-3 disabled:opacity-60 disabled:cursor-not-allowed hover:bg-primary/90 transition"
        >
          {busy || checkoutLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing…
            </>
          ) : expired ? (
            'Payment window closed'
          ) : (
            <>Pay ₹{total} now</>
          )}
        </button>

        {/* Red cancel CTA — the trip hasn't started so the user never pays
            a cancellation fee for bailing out here. */}
        <button
          type="button"
          disabled={busy || cancelling}
          onClick={handleCancelRequest}
          className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 text-red-600 font-semibold py-2.5 text-sm disabled:opacity-60 disabled:cursor-not-allowed hover:bg-red-100 transition"
        >
          {cancelling ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Cancelling…
            </>
          ) : (
            'Cancel ride'
          )}
        </button>

        <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-text-muted">
          <Shield className="w-3 h-3 text-success" />
          Secure Razorpay checkout · UPI, cards, wallets, netbanking
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => !cancelling && setConfirmOpen(false)}
        onConfirm={handleCancelConfirm}
        title="Cancel this booking?"
        description="You won't be charged — the driver will be released to take other rides."
        confirmLabel="Cancel ride"
        cancelLabel="Keep ride"
        variant="danger"
        loading={cancelling}
      />
    </div>
  );
};

export default PaymentChoiceSheet;
