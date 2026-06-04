import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  Wallet as WalletIcon,
  MapPin,
  CircleDot,
  Calendar,
  Clock,
  Car,
  Plus,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Utensils,
  Moon,
} from 'lucide-react';
import Card from '../../../../components/Card';
import Button from '../../../../components/Button';
import api from '../../../../utils/api';
import useBookingDraftStore from '../../../../store/user/useBookingDraftStore';
import useUserActiveBookingStore from '../../../../store/user/useUserActiveBookingStore';
import useUserWalletStore from '../../../../store/user/useUserWalletStore';
import { SERVICE_TYPES, SERVICE_TYPE_LABELS } from '../../../../constants/serviceTypes';
import { BOOKING_STATUS } from '../../../../constants/bookingStatus';
import { formatPickupDateTime, formatDateShort } from '../../../../utils/datetime';
import { getCarBrandName, getCarModelName } from '../../../../utils/vehicleCatalog';
import FareCard from '../components/FareCard';
import useFareEstimate from '../hooks/useFareEstimate';
import TopupSheet from '../../wallet/components/TopupSheet';

/**
 * Final booking confirmation screen — replaces the legacy "Review then go
 * pay via Razorpay after a driver accepts" flow.
 *
 * Now:
 *   1. Recompute the fare live (server-side estimate).
 *   2. Show the wallet balance + the deficit (if any).
 *   3. "Pay from wallet" → POST /auth/bookings creates the booking and
 *      atomically debits the wallet.
 *   4. If the wallet is short, we open the TopupSheet pre-filled with the
 *      exact shortfall (rounded up), and on success we auto-retry the
 *      booking-create call.
 *
 * Reachable from both the new hourly slab page and the legacy outstation
 * review page via `navigate('/user/book/confirm')`.
 */
const ConfirmAndPayPage = () => {
  const navigate = useNavigate();
  const draft = useBookingDraftStore();
  const setFareEstimate = useBookingDraftStore((s) => s.setFareEstimate);
  const createBooking = useUserActiveBookingStore((s) => s.createBooking);

  const wallet = useUserWalletStore((s) => s.wallet);
  const fetchWallet = useUserWalletStore((s) => s.fetchWallet);

  const [selectedCar, setSelectedCar] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [topupOpen, setTopupOpen] = useState(false);
  const [shortfall, setShortfall] = useState(0);

  // Guard: bounce back to the start of the flow if state is incomplete.
  useEffect(() => {
    if (!draft.serviceType || !draft.pickup || !draft.carId) {
      navigate('/user/book/service', { replace: true });
    }
  }, [draft.serviceType, draft.pickup, draft.carId, navigate]);

  useEffect(() => {
    fetchWallet().catch(() => {});
  }, [fetchWallet]);

  // Resolve the selected car for the summary block — tolerant on failure.
  useEffect(() => {
    let cancelled = false;
    if (!draft.carId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing on carId removal
      setSelectedCar(null);
      return undefined;
    }
    api
      .get('/auth/cars')
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res?.data?.data) ? res.data.data : [];
        setSelectedCar(list.find((c) => c._id === draft.carId) || null);
      })
      .catch(() => {
        if (!cancelled) setSelectedCar(null);
      });
    return () => {
      cancelled = true;
    };
  }, [draft.carId]);

  // Live fare estimate — fully reuses the booking-flow hook so the wire
  // format stays in lockstep with the slab page.
  const estimatePayload = useMemo(() => {
    if (!draft.serviceType || !draft.pickup) return null;
    const base = { serviceType: draft.serviceType };
    if (draft.serviceType === SERVICE_TYPES.HOURLY) {
      base.slabId = draft.hourly.isCustomDuration ? null : draft.hourly.slabId;
      base.bookedHours = draft.hourly.durationHours;
      base.scheduledAt = draft.hourly.scheduledStartAt;
      if (draft.hourly.foodProvided != null) base.foodProvided = !!draft.hourly.foodProvided;
      if (draft.hourly.stayProvided != null) base.stayProvided = !!draft.hourly.stayProvided;
    } else {
      base.days = draft.outstation.days;
      base.scheduledAt = draft.outstation.startDate;
      base.foodProvided = draft.outstation.needsFood;
      base.stayProvided = draft.outstation.needsStay;
    }
    return base;
  }, [draft]);

  const { estimate, loading: estimating, error: estimateError } = useFareEstimate(
    estimatePayload,
    { onResult: (data) => setFareEstimate(data) },
  );

  const total = Number(estimate?.fareBreakdown?.totalPayable || 0);
  const balance = Number(wallet.balance || 0);
  const canPay = balance >= total && total > 0;

  // Mandatory food acknowledgement gate (hourly only). The slab page
  // is meant to capture this, but a direct landing on /confirm — or a
  // back-nav after toggling slabs — could leave the flag stale, so we
  // double-check at pay-time. Block the CTA until the customer has
  // confirmed they'll feed the driver.
  const foodRequired = !!estimate?.fareBreakdown?.foodRequired;
  const isHourly = draft.serviceType === SERVICE_TYPES.HOURLY;
  const foodAcknowledged = !!draft.hourly?.foodAcknowledged;
  const foodGateUnmet = isHourly && foodRequired && !foodAcknowledged;
  const setHourly = useBookingDraftStore((s) => s.setHourly);

  const handlePay = useCallback(async () => {
    if (submitting || !total) return;
    if (foodGateUnmet) {
      toast.error('Please confirm you\u2019ll arrange the driver\u2019s meal');
      return;
    }
    
    const freshBalance = Number(useUserWalletStore.getState().wallet?.balance || 0);
    if (freshBalance < total) {
      setShortfall(Math.max(0, total - freshBalance));
      setTopupOpen(true);
      return;
    }
    
    setSubmitting(true);
    try {
      const payload = useBookingDraftStore.getState().buildCreatePayload();
      const { booking } = await createBooking(payload);
      if (booking) {
        // Optimistically pull a fresh wallet snapshot — the debit
        // already happened server-side; this keeps the bottom-nav badge
        // and the wallet page in sync without a manual refresh.
        fetchWallet().catch(() => {});
        // Long-lead scheduled bookings (`PENDING_ASSIGNMENT`) go to a
        // dedicated "ride scheduled" screen — the worker hasn't even
        // started searching yet, so the spinner page would be misleading.
        // Morning + short-window scheduled bookings come back as
        // SEARCHING and use the existing flow.
        if (booking.status === BOOKING_STATUS.PENDING_ASSIGNMENT) {
          navigate('/user/book/scheduled');
        } else {
          navigate('/user/book/searching');
        }
      }
    } catch (err) {
      // The wallet service throws ApiError(402) with `{ shortBy, ... }`
      // when the balance moved between fetch and create (rare but real).
      // We intercept and re-open the TopupSheet pre-filled.
      const data = err?.response?.data?.data || {};
      if (err?.response?.status === 402 && Number(data.shortBy) > 0) {
        setShortfall(Number(data.shortBy));
        setTopupOpen(true);
        return;
      }
      // Per-car overlap: backend rejects when the selected car already
      // has an active or overlapping booking. Surface a longer, more
      // explanatory toast so the customer knows to pick a different car
      // or pickup time — they can also book another car in parallel.
      if (
        err?.response?.status === 409 &&
        (data.code === 'CAR_TIME_CONFLICT' || data.code === 'CAR_HAS_ACTIVE_BOOKING')
      ) {
        toast.error(
          err?.response?.data?.message ||
            'This car is already booked for an overlapping time. Pick a different car or change the pickup time.',
          { duration: 6000 },
        );
        return;
      }
      // Scheduled rides require enough lead time for the safety window.
      if (err?.response?.status === 422) {
        toast.error(
          err?.response?.data?.message ||
            'Pick a later pickup time and try again.',
          { duration: 5000 },
        );
        return;
      }
      toast.error(err?.response?.data?.message || err?.message || 'Could not place booking');
    } finally {
      setSubmitting(false);
    }
  }, [submitting, total, canPay, balance, createBooking, fetchWallet, navigate, foodGateUnmet]);

  // Auto-retry the booking creation after a successful top-up so the user
  // doesn't have to click "Pay" again.
  const handleTopupSuccess = useCallback(async () => {
    setTopupOpen(false);
    // Give Zustand a tick to apply the wallet patch before checking again.
    setTimeout(() => {
      handlePay();
    }, 50);
  }, [handlePay]);

  return (
    <div className="flex-1 flex flex-col bg-bg min-h-dvh">
      <div className="bg-white px-4 pt-4 pb-4 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-xl hover:bg-gray-100"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5 text-text" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-text">Confirm & pay</h1>
            <p className="text-xs text-text-muted">
              Pay from your wallet to start searching for a driver.
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-4">
        <TripSummary draft={draft} car={selectedCar} />
        <FareCard estimate={estimate} estimating={estimating} error={estimateError} />
        <FareNotices estimate={estimate} />
        {isHourly && foodRequired && (
          <FoodAcknowledgement
            thresholdHours={Number(
              estimate?.extrasConfig?.foodAllowance?.thresholdHours || 0,
            )}
            checked={foodAcknowledged}
            onChange={(v) => setHourly({ foodAcknowledged: v })}
          />
        )}
        <WalletBalanceCard
          balance={balance}
          total={total}
          shortBy={Math.max(0, total - balance)}
          loading={estimating}
          onAddMoney={() => {
            setShortfall(Math.max(0, total - balance));
            setTopupOpen(true);
          }}
        />
        <p className="text-[11px] text-text-muted text-center">
          The fare is held in your wallet. If no driver is found you get a
          full refund right back to your wallet.
        </p>
      </div>

      <div className="bg-white border-t border-border-light px-4 py-3">
        <Button
          fullWidth
          icon={WalletIcon}
          loading={submitting}
          disabled={!estimate || estimating || total <= 0 || foodGateUnmet}
          onClick={handlePay}
        >
          {!total
            ? 'Calculating fare…'
            : foodGateUnmet
              ? 'Confirm driver\u2019s meal to continue'
              : canPay
                ? `Pay \u20B9${total} from wallet`
                : `Add \u20B9${Math.max(0, total - balance).toFixed(2)} & pay`}
        </Button>
      </div>

      <TopupSheet
        open={topupOpen}
        onClose={() => setTopupOpen(false)}
        suggestedAmount={shortfall}
        title="Top up to confirm booking"
        subtitle={
          shortfall > 0
            ? `You need ₹${Math.round(shortfall)} more to pay this booking.`
            : null
        }
        onSuccess={handleTopupSuccess}
      />
    </div>
  );
};

/* ------------------------------------------------------------------ */

/**
 * Rich wallet balance card with a live "balance vs fare" progress bar
 * so the customer can see at a glance whether they're funded for this
 * booking. Switches between two visual states:
 *
 *   funded     gradient slate card · big checkmark · "Ready to pay"
 *   short      cream/amber card    · clear shortfall callout · CTA
 */
function WalletBalanceCard({ balance, total, shortBy, loading, onAddMoney }) {
  const enough = total > 0 && balance >= total;
  const pct =
    total > 0 ? Math.min(100, Math.round((balance / total) * 100)) : 0;
  const fmt = (n) =>
    `\u20B9${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

  if (enough) {
    return (
      <div className="rounded-3xl overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 text-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-white/60">
              Wallet balance
            </p>
            <p className="text-2xl font-bold mt-1">{fmt(balance)}</p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-emerald-400/20 text-emerald-300 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between text-[12px] text-white/80">
          <span>
            Fare due <strong className="text-white">{fmt(total)}</strong>
          </span>
          <span className="inline-flex items-center gap-1 text-emerald-300 font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" /> Ready to pay
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl overflow-hidden border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-amber-800/80">
            Wallet balance
          </p>
          <p className="text-2xl font-bold text-text mt-1">{fmt(balance)}</p>
          <p className="text-[11px] text-text-muted mt-0.5">
            Fare due {fmt(total)}{' '}
            {loading ? <span className="text-text-muted">…</span> : null}
          </p>
        </div>
        <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
          <WalletIcon className="w-5 h-5" />
        </div>
      </div>

      {total > 0 && (
        <div className="mt-3">
          <div className="h-1.5 rounded-full bg-amber-100 overflow-hidden">
            <div
              className="h-full bg-amber-500 transition-[width] duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-amber-800/80 font-medium">
            <span>{pct}% covered</span>
            <span>100%</span>
          </div>
        </div>
      )}

      {total > 0 && (
        <div className="mt-3 rounded-2xl bg-white border border-amber-200 p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-text">
              You&apos;re {fmt(shortBy)} short
            </p>
            <p className="text-[11px] text-text-muted">
              Top up now &mdash; we&apos;ll retry your booking automatically.
            </p>
          </div>
          <button
            type="button"
            onClick={onAddMoney}
            className="inline-flex items-center gap-1 px-3 h-9 rounded-xl bg-primary text-white text-xs font-semibold shadow-sm hover:bg-primary-dark transition shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Add {fmt(Math.round(shortBy))}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Informational chips rendered between the fare and wallet cards.
 *
 * Food acknowledgement for hourly bookings is rendered as a separate
 * mandatory checkbox (see {@link FoodAcknowledgement}) — it can't be a
 * passive notice because the customer has to opt in. The chip here is
 * only used for outstation, where the food allowance is billed and the
 * customer just needs a heads-up that a charge is included.
 *
 *   - "Driver food allowance included" (outstation only)
 *   - "Night charge included" when the ride hours overlap the configured
 *     night window OR cross the night-charge duration threshold.
 */
function FareNotices({ estimate }) {
  const bd = estimate?.fareBreakdown || {};
  const serviceType = estimate?.serviceType;
  const isOutstationFood =
    serviceType === SERVICE_TYPES.OUTSTATION && Number(bd.foodAllowance) > 0;
  const nightTriggered = !!bd.nightChargeTriggered && Number(bd.nightCharge) > 0;
  if (!isOutstationFood && !nightTriggered) return null;

  return (
    <div className="space-y-2">
      {isOutstationFood && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <Utensils className="w-4 h-4 text-amber-700" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-amber-900">
              {`Driver food allowance included (\u20B9${bd.foodAllowance})`}
            </p>
            <p className="text-[12px] text-amber-800 leading-snug mt-0.5">
              Toggle &ldquo;I&apos;ll arrange the driver&apos;s meals&rdquo; on
              the trip review screen to remove this from the fare.
            </p>
          </div>
        </div>
      )}
      {nightTriggered && (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-3 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
            <Moon className="w-4 h-4 text-indigo-700" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-indigo-900">
              {`Night charge applied (\u20B9${bd.nightCharge})`}
            </p>
            <p className="text-[12px] text-indigo-800 leading-snug mt-0.5">
              Your booking covers night hours. The night charge is already
              included in the fare above.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Mandatory acknowledgement for hourly bookings that cross the food
 * threshold. Mirrors the slab-page checkbox so the customer can also
 * tick it here if they jumped straight in. Blocks the Pay CTA until
 * checked — see `foodGateUnmet` in the parent.
 */
function FoodAcknowledgement({ thresholdHours, checked, onChange }) {
  return (
    <label
      className={`rounded-2xl border p-3 flex items-start gap-3 cursor-pointer transition ${
        checked
          ? 'border-emerald-200 bg-emerald-50'
          : 'border-amber-300 bg-amber-50'
      }`}
    >
      <div
        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
          checked
            ? 'bg-emerald-100 text-emerald-700'
            : 'bg-amber-100 text-amber-700'
        }`}
      >
        <Utensils className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p
            className={`text-sm font-bold ${
              checked ? 'text-emerald-900' : 'text-amber-900'
            }`}
          >
            I&apos;ll arrange the driver&apos;s meal
          </p>
          {!checked && (
            <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-200 text-amber-900">
              Required
            </span>
          )}
        </div>
        <p
          className={`text-[12px] leading-snug mt-0.5 ${
            checked ? 'text-emerald-800' : 'text-amber-800'
          }`}
        >
          Bookings of {thresholdHours || 'this length'} hours or more cross
          meal time. We don&apos;t add a food charge to your fare &mdash;
          please confirm you&apos;ll feed the driver during the trip.
        </p>
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(!!e.target.checked)}
        className="mt-1 w-4 h-4 accent-emerald-600 shrink-0"
        aria-label="Confirm you will arrange the driver's meal"
      />
    </label>
  );
}

function TripSummary({ draft, car }) {
  const isHourly = draft.serviceType === SERVICE_TYPES.HOURLY;
  const schedule = isHourly ? draft.hourly?.scheduledStartAt : draft.outstation?.startDate;
  const dropAddress = draft.dropoff?.address || draft.outstation?.destinationAddress;

  return (
    <Card>
      <div className="space-y-4">
        <div className="flex gap-3">
          <div className="flex flex-col items-center gap-1 pt-1">
            <CircleDot className="w-4 h-4 text-success" />
            {!isHourly && dropAddress && (
              <>
                <div className="w-0.5 h-8 bg-gray-200" />
                <MapPin className="w-4 h-4 text-danger" />
              </>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div>
              <p className="text-xs text-text-muted">Pickup</p>
              <p className="text-sm font-medium text-text break-words">
                {draft.pickup?.address}
              </p>
            </div>
            {!isHourly && dropAddress && (
              <div className="mt-3">
                <p className="text-xs text-text-muted">Destination</p>
                <p className="text-sm font-medium text-text break-words">{dropAddress}</p>
              </div>
            )}
          </div>
        </div>

        {car && (
          <>
            <div className="h-px bg-border-light" />
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gray-100 overflow-hidden flex items-center justify-center shrink-0">
                {car.image ? (
                  <img src={car.image} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Car className="w-5 h-5 text-text-muted" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-text-muted">Your car</p>
                <p className="text-sm font-semibold text-text truncate">
                  {getCarBrandName(car)} · {getCarModelName(car)}
                </p>
                <p className="text-[11px] font-mono text-text-secondary">
                  {car.vehicleNumber}
                </p>
              </div>
            </div>
          </>
        )}

        <div className="h-px bg-border-light" />

        <div className="grid grid-cols-2 gap-3">
          <FactRow
            icon={Calendar}
            label={isHourly ? 'Pickup time' : 'Trip dates'}
            value={
              isHourly
                ? formatPickupDateTime(schedule)
                : `${formatDateShort(draft.outstation?.startDate)} \u2192 ${formatDateShort(draft.outstation?.endDate)}`
            }
          />
          <FactRow
            icon={Clock}
            label={isHourly ? 'Duration' : 'Days'}
            value={
              isHourly
                ? `${draft.hourly?.durationHours || 0} h`
                : `${draft.outstation?.days || 1} day · ${draft.outstation?.nights || 0} night`
            }
          />
          <FactRow icon={Car} label="Service" value={SERVICE_TYPE_LABELS[draft.serviceType]} />
          {!isHourly && (
            <FactRow
              icon={MapPin}
              label="Driver stay/food"
              value={`${draft.outstation?.needsStay ? 'We arrange stay' : 'Customer arranges'}, ${
                draft.outstation?.needsFood ? 'we arrange food' : 'customer arranges'
              }`}
            />
          )}
        </div>
      </div>
    </Card>
  );
}

function FactRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2 min-w-0">
      <Icon className="w-4 h-4 text-text-muted shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-[10px] text-text-muted">{label}</p>
        <p className="text-xs font-medium text-text truncate">{value}</p>
      </div>
    </div>
  );
}

export default ConfirmAndPayPage;
