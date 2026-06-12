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
  Pencil,
  X,
  CalendarClock,
  HandCoins,
  AlertCircle,
} from 'lucide-react';
import Card from '../../../../components/Card';
import Button from '../../../../components/Button';
import api from '../../../../utils/api';
import useBookingDraftStore from '../../../../store/user/useBookingDraftStore';
import useUserActiveBookingStore from '../../../../store/user/useUserActiveBookingStore';
import useUserWalletStore from '../../../../store/user/useUserWalletStore';
import { SERVICE_TYPES, SERVICE_TYPE_LABELS } from '../../../../constants/serviceTypes';
import { BOOKING_STATUS } from '../../../../constants/bookingStatus';
import { formatPickupDateTime } from '../../../../utils/datetime';
import { getCarBrandName, getCarModelName } from '../../../../utils/vehicleCatalog';
import FareCard from '../components/FareCard';
import useFareEstimate from '../hooks/useFareEstimate';
import TopupSheet from '../../wallet/components/TopupSheet';

/**
 * Combined Review + Confirm & pay screen.
 *
 * Earlier the booking flow had two near-identical screens:
 *   /user/book/review   – trip summary + fare estimate + outstation
 *                         food/stay toggle.
 *   /user/book/confirm  – trip summary + fare estimate + wallet + pay CTA.
 *
 * They've been consolidated into this single page so the user only
 * sees one "review your trip" surface. For outstation that means the
 * food-and-stay toggle lives here (and re-runs the estimate live), and
 * the toll/parking acknowledgement is gated behind the pay CTA via a
 * confirmation dialog instead of an always-on inline banner.
 *
 *   1. Recompute the fare live via `useFareEstimate` whenever the
 *      relevant draft fields change (incl. the food/stay toggle).
 *   2. Show the wallet balance + the deficit (if any).
 *   3. Pay CTA:
 *        – Outstation: first surface the toll/parking ack popup.
 *          Customer must accept before we run step 4.
 *        – Hourly:     proceeds straight to step 4.
 *   4. POST /auth/bookings creates the booking and atomically debits
 *      the wallet.
 *   5. If the wallet is short, we open the TopupSheet pre-filled with
 *      the exact shortfall (rounded up), and on success we auto-retry
 *      the booking-create call.
 *
 * Header + footer are sticky so the running total + back button are
 * always visible while the user scrolls through the trip recap.
 */
const ConfirmAndPayPage = () => {
  const navigate = useNavigate();
  const draft = useBookingDraftStore();
  const setFareEstimate = useBookingDraftStore((s) => s.setFareEstimate);
  const setOutstation = useBookingDraftStore((s) => s.setOutstation);
  const createBooking = useUserActiveBookingStore((s) => s.createBooking);

  const wallet = useUserWalletStore((s) => s.wallet);
  const fetchWallet = useUserWalletStore((s) => s.fetchWallet);

  const setCarId = useBookingDraftStore((s) => s.setCarId);

  const [selectedCar, setSelectedCar] = useState(null);
  const [allCars, setAllCars] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [topupOpen, setTopupOpen] = useState(false);
  const [shortfall, setShortfall] = useState(0);
  const [carEditOpen, setCarEditOpen] = useState(false);
  const [pickupEditOpen, setPickupEditOpen] = useState(false);
  const [conflictError, setConflictError] = useState(null); // { title, message, type: 'car'|'time' }
  const [tollAckOpen, setTollAckOpen] = useState(false);

  // Guard: bounce back to the start of the flow if state is incomplete.
  useEffect(() => {
    if (!draft.serviceType || !draft.pickup || !draft.carId) {
      navigate('/user/book/service', { replace: true });
    }
  }, [draft.serviceType, draft.pickup, draft.carId, navigate]);

  useEffect(() => {
    fetchWallet().catch(() => { });
  }, [fetchWallet]);

  // Fetch car list once — used both for the summary and the edit sheet.
  useEffect(() => {
    let cancelled = false;
    api
      .get('/auth/cars')
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res?.data?.data) ? res.data.data : [];
        setAllCars(list);
        setSelectedCar(list.find((c) => c._id === draft.carId) || null);
      })
      .catch(() => {
        if (!cancelled) setSelectedCar(null);
      });
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep selectedCar in sync when the draft carId changes (e.g. after edit).
  useEffect(() => {
    if (!allCars.length) return;
    setSelectedCar(allCars.find((c) => c._id === draft.carId) || null);
  }, [draft.carId, allCars]);

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
      base.scheduledAt =
        draft.outstation.pickupAt || draft.outstation.startDate;
      base.foodProvided = draft.outstation.needsFood;
      base.stayProvided = draft.outstation.needsStay;
    }
    return base;
  }, [draft]);

  const { estimate, loading: estimating, error: estimateError } = useFareEstimate(
    estimatePayload,
    { onResult: (data) => setFareEstimate(data) },
  );

  // `total` is the *full wallet requirement*: fare charged immediately
  // + the waiting reserve we hold against `wallet.heldRupees`. Even
  // though the buffer isn't debited, the user must have it in the
  // wallet for the booking to start.
  const fareTotal = Number(estimate?.fareBreakdown?.totalPayable || 0);
  const bufferRupees = Number(estimate?.waitingBuffer?.bufferRupees || 0);
  const total = Math.round((fareTotal + bufferRupees) * 100) / 100;
  // We compare against *available* balance (balance − heldRupees from
  // other active bookings) so a user with funds locked in another
  // booking's buffer can't accidentally over-book.
  const balance = Number(wallet.balance || 0);
  const heldElsewhere = Number(wallet.heldRupees || 0);
  const available = Math.max(0, Math.round((balance - heldElsewhere) * 100) / 100);
  const canPay = available >= total && total > 0;

  // Mandatory food acknowledgement gate (hourly only). The slab page
  // is meant to capture this, but a direct landing on /confirm — or a
  // back-nav after toggling slabs — could leave the flag stale, so we
  // double-check at pay-time. Block the CTA until the customer has
  // confirmed they'll feed the driver.
  const foodRequired = !!estimate?.fareBreakdown?.foodRequired;
  const isHourly = draft.serviceType === SERVICE_TYPES.HOURLY;
  const isOutstation = draft.serviceType === SERVICE_TYPES.OUTSTATION;
  const foodAcknowledged = !!draft.hourly?.foodAcknowledged;
  const foodGateUnmet = isHourly && foodRequired && !foodAcknowledged;
  const setHourly = useBookingDraftStore((s) => s.setHourly);

  // Outstation food + stay arrangement toggle — both flags flip
  // together because the fare engine ANDs them into a single
  // "customer arranges everything" signal. Convention is documented
  // on the booking-draft store.
  const customerArrangesAll =
    isOutstation
    && draft.outstation?.needsFood === true
    && draft.outstation?.needsStay === true;
  const handleArrangesToggle = useCallback(
    (next) => {
      setOutstation({
        needsFood: next,
        needsStay: next,
      });
    },
    [setOutstation],
  );

  // Per-night allowance preview for the FoodStayCard subtitle —
  // "₹X × N nights = ₹Y" so the customer sees the saving at a glance.
  const allowancePerNight =
    Number(estimate?.fareBreakdown?.allowancePerNight) || 0;
  const tripNights = Number(estimate?.fareBreakdown?.nights) || 0;

  // Actual booking creation. Split out from `handlePay` so the
  // toll/parking acknowledgement dialog can call it after the customer
  // accepts.
  const submitBooking = useCallback(async () => {
    if (submitting || !total) return;

    const freshWallet = useUserWalletStore.getState().wallet || {};
    const freshBalance = Number(freshWallet.balance || 0);
    const freshHeld = Number(freshWallet.heldRupees || 0);
    const freshAvailable = Math.max(0, freshBalance - freshHeld);
    if (freshAvailable < total) {
      setShortfall(Math.max(0, Math.round((total - freshAvailable) * 100) / 100));
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
        fetchWallet().catch(() => { });
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
      // Per-car overlap: show a modal so the user has clear actions.
      if (
        err?.response?.status === 409 &&
        (data.code === 'CAR_TIME_CONFLICT' || data.code === 'CAR_HAS_ACTIVE_BOOKING')
      ) {
        setConflictError({
          title: 'Car already booked',
          message:
            err?.response?.data?.message ||
            'This car is already booked for an overlapping time. Pick a different car or change the pickup time.',
          type: 'car',
        });
        return;
      }
      // Scheduled rides require enough lead time — show in a modal.
      if (err?.response?.status === 422) {
        setConflictError({
          title: 'Pickup time too soon',
          message:
            err?.response?.data?.message ||
            'We need more lead time for scheduled rides. Please pick a later pickup time.',
          type: 'time',
        });
        return;
      }
      toast.error(err?.response?.data?.message || err?.message || 'Could not place booking');
    } finally {
      setSubmitting(false);
    }
  }, [submitting, total, createBooking, fetchWallet, navigate]);

  // Pay CTA entry point. Hourly is straight-through; outstation must
  // first acknowledge the toll & parking disclosure (since those are
  // paid directly to the driver and aren't part of this fare).
  const handlePay = useCallback(() => {
    if (submitting || !total) return;
    if (foodGateUnmet) {
      toast.error('Please confirm you\u2019ll arrange the driver\u2019s meal');
      return;
    }
    if (isOutstation) {
      setTollAckOpen(true);
      return;
    }
    submitBooking();
  }, [submitting, total, foodGateUnmet, isOutstation, submitBooking]);

  // Outstation toll/parking ack flow → user accepted, run the create.
  const handleTollAcknowledged = useCallback(() => {
    setTollAckOpen(false);
    submitBooking();
  }, [submitBooking]);

  // Auto-retry the booking creation after a successful top-up so the user
  // doesn't have to click "Pay" again.
  const handleTopupSuccess = useCallback(async () => {
    setTopupOpen(false);
    // Give Zustand a tick to apply the wallet patch before checking
    // again. We bypass `handlePay` (which would re-open the toll
    // dialog) and call submitBooking directly — the user already
    // acknowledged the disclosure that triggered the top-up.
    setTimeout(() => {
      submitBooking();
    }, 50);
  }, [submitBooking]);

  return (
    <div className="flex-1 flex flex-col bg-bg min-h-dvh">
      {/* Sticky header keeps Back + page title in view while the user
          scrolls through trip + fare + wallet sections. */}
      <div className="sticky top-0 z-30 bg-white px-4 pt-4 pb-4 shadow-sm">
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
            <h1 className="text-lg font-bold text-text">Review &amp; pay</h1>
            <p className="text-xs text-text-muted">
              Confirm the details and pay from your wallet to start
              searching for a driver.
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-4">
        <TripSummary
          draft={draft}
          car={selectedCar}
          onEditCar={() => setCarEditOpen(true)}
          onEditPickup={() => setPickupEditOpen(true)}
        />
        {/*
          Outstation: single all-or-nothing toggle for the customer
          arranging the driver's food + stay themselves. Flipping it
          patches both `needsFood` and `needsStay` on the draft, which
          is the exact key `useFareEstimate` keys off — so the next
          `/auth/bookings/estimate` call (debounced ~250 ms) reflects
          the new choice and the fare card + pay CTA both update.
        */}
        {isOutstation && (
          <FoodStayCard
            customerArrangesAll={customerArrangesAll}
            allowancePerNight={allowancePerNight}
            nights={tripNights}
            onChange={handleArrangesToggle}
          />
        )}
        <FareCard estimate={estimate} estimating={estimating} error={estimateError} />
        <FareNotices estimate={estimate} />
        {isOutstation && (
          <OutstationCancellationPolicySummary
            policy={estimate?.cancellationPolicy?.outstation}
            dailyRate={Number(estimate?.fareBreakdown?.dailyRate) || 0}
          />
        )}
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
          available={available}
          heldElsewhere={heldElsewhere}
          fareTotal={fareTotal}
          bufferRupees={bufferRupees}
          total={total}
          shortBy={Math.max(0, total - available)}
          loading={estimating}
          onAddMoney={() => {
            setShortfall(Math.max(0, total - available));
            setTopupOpen(true);
          }}
        />
        <p className="text-[11px] text-text-muted text-center">
          The fare is held in your wallet. If no driver is found you get a
          full refund right back to your wallet.
        </p>
      </div>

      {/* Sticky footer — pay CTA (with the running total) is always
          reachable without scrolling. */}
      <div className="sticky bottom-0 z-30 bg-white border-t border-border-light px-4 py-3 shadow-[0_-4px_12px_-8px_rgba(0,0,0,0.15)]">
        <Button
          fullWidth
          icon={WalletIcon}
          loading={submitting}
          disabled={!estimate || estimating || total <= 0 || foodGateUnmet}
          onClick={handlePay}
        >
          {!total
            ? 'Calculating fare\u2026'
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

      {/* Edit car bottom-sheet */}
      <EditCarSheet
        open={carEditOpen}
        cars={allCars}
        selectedCarId={draft.carId}
        onClose={() => setCarEditOpen(false)}
        onSelect={(carId) => {
          setCarId(carId);
          setCarEditOpen(false);
        }}
      />

      {/* Pickup time / hours change confirmation */}
      <PickupTimeConfirmDialog
        open={pickupEditOpen}
        onClose={() => setPickupEditOpen(false)}
        onConfirm={() => {
          setPickupEditOpen(false);
          navigate('/user/book/hourly/type');
        }}
      />

      {/* Conflict / validation error modal */}
      <ConflictErrorDialog
        error={conflictError}
        onClose={() => setConflictError(null)}
        onChangeCar={() => {
          setConflictError(null);
          setCarEditOpen(true);
        }}
        onChangePickup={() => {
          setConflictError(null);
          setPickupEditOpen(true);
        }}
      />

      {/* Outstation: toll & parking are paid by the customer directly
          to the driver during the trip — surfaced as an explicit
          acknowledgement before we kick off the booking creation. */}
      <TollParkingAckDialog
        open={tollAckOpen}
        submitting={submitting}
        onAccept={handleTollAcknowledged}
        onCancel={() => setTollAckOpen(false)}
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
function WalletBalanceCard({
  balance,
  available,
  heldElsewhere,
  fareTotal,
  bufferRupees,
  total,
  shortBy,
  loading,
  onAddMoney,
}) {
  const enough = total > 0 && available >= total;
  const pct =
    total > 0 ? Math.min(100, Math.round((available / total) * 100)) : 0;
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
            {heldElsewhere > 0 && (
              <p className="text-[10px] text-white/60 mt-0.5">
                {fmt(heldElsewhere)} locked in active bookings · {fmt(available)} available
              </p>
            )}
          </div>
          <div className="w-10 h-10 rounded-2xl bg-emerald-400/20 text-emerald-300 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-4 space-y-1 text-[12px] text-white/80">
          <div className="flex items-center justify-between">
            <span>Charged from wallet</span>
            <strong className="text-white">{fmt(fareTotal)}</strong>
          </div>
          {bufferRupees > 0 && (
            <div className="flex items-center justify-between">
              <span>Reserved for waiting (refundable)</span>
              <strong className="text-white">{fmt(bufferRupees)}</strong>
            </div>
          )}
          <div className="pt-1 flex items-center justify-between border-t border-white/10 mt-2">
            <span className="font-semibold text-white">Wallet needed</span>
            <span className="inline-flex items-center gap-1 text-emerald-300 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" /> {fmt(total)}
            </span>
          </div>
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
            {heldElsewhere > 0
              ? `${fmt(heldElsewhere)} locked elsewhere \u00B7 ${fmt(available)} available`
              : `You need ${fmt(total)} to book this ride`}{' '}
            {loading ? <span className="text-text-muted">…</span> : null}
          </p>
        </div>
        <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
          <WalletIcon className="w-5 h-5" />
        </div>
      </div>

      {total > 0 && bufferRupees > 0 && (
        <div className="mt-3 rounded-2xl bg-white/60 border border-amber-200 px-3 py-2 text-[11px] text-text-secondary space-y-0.5">
          <div className="flex items-center justify-between">
            <span>Fare (charged now)</span>
            <strong className="text-text">{fmt(fareTotal)}</strong>
          </div>
          <div className="flex items-center justify-between">
            <span>Waiting reserve (held in wallet)</span>
            <strong className="text-text">{fmt(bufferRupees)}</strong>
          </div>
        </div>
      )}

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
              You need {fmt(shortBy)} more in your wallet
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
              Toggle &ldquo;I&apos;ll arrange the driver&apos;s meals&rdquo;
              above to remove this from the fare.
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
      className={`rounded-2xl border p-3 flex items-start gap-3 cursor-pointer transition ${checked
          ? 'border-emerald-200 bg-emerald-50'
          : 'border-amber-300 bg-amber-50'
        }`}
    >
      <div
        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${checked
            ? 'bg-emerald-100 text-emerald-700'
            : 'bg-amber-100 text-amber-700'
          }`}
      >
        <Utensils className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p
            className={`text-sm font-bold ${checked ? 'text-emerald-900' : 'text-amber-900'
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
          className={`text-[12px] leading-snug mt-0.5 ${checked ? 'text-emerald-800' : 'text-amber-800'
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

function TripSummary({ draft, car, onEditCar, onEditPickup }) {
  const isHourly = draft.serviceType === SERVICE_TYPES.HOURLY;
  const schedule = isHourly
    ? draft.hourly?.scheduledStartAt
    : draft.outstation?.pickupAt || draft.outstation?.startDate;
  const expectedReturn =
    draft.outstation?.expectedReturnAt || draft.outstation?.endDate;
  const dropAddress = draft.dropoff?.address || draft.outstation?.destinationAddress;

  return (
    <Card>
      <div className="space-y-4">
        {/* Pickup address */}
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
                <p className="text-[11px] text-text-muted mt-0.5">
                  Round trip — we drop you back at the pickup.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Car row — with edit button */}
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
              {onEditCar && (
                <button
                  type="button"
                  onClick={onEditCar}
                  className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 h-8 rounded-xl border border-border bg-gray-50 hover:bg-primary/5 hover:border-primary/30 text-text-muted hover:text-primary text-[11px] font-semibold transition"
                >
                  <Pencil className="w-3 h-3" />
                  Edit
                </button>
              )}
            </div>
          </>
        )}

        <div className="h-px bg-border-light" />

        {/* Schedule / duration grid — with edit button for hourly */}
        <div className="flex items-start gap-2">
          <div className="flex-1 grid grid-cols-2 gap-3">
            <FactRow
              icon={Calendar}
              label={isHourly ? 'Pickup time' : 'Pickup'}
              value={formatPickupDateTime(schedule)}
            />
            {!isHourly && (
              <FactRow
                icon={Calendar}
                label="Expected return"
                value={formatPickupDateTime(expectedReturn)}
              />
            )}
            <FactRow
              icon={Clock}
              label={isHourly ? 'Duration' : 'Days \u00b7 nights'}
              value={
                isHourly
                  ? `${draft.hourly?.durationHours || 0} h`
                  : `${draft.outstation?.days || 1} day${(draft.outstation?.days || 1) === 1 ? '' : 's'} \u00b7 ${draft.outstation?.nights || 0} night${(draft.outstation?.nights || 0) === 1 ? '' : 's'}`
              }
            />
            <FactRow icon={Car} label="Service" value={SERVICE_TYPE_LABELS[draft.serviceType]} />
            {!isHourly && (
              <FactRow
                icon={HandCoins}
                label="Driver food & stay"
                value={
                  draft.outstation?.needsFood === true
                    && draft.outstation?.needsStay === true
                    ? 'Arranged by customer (no allowance)'
                    : 'Allowance billed per night'
                }
              />
            )}
          </div>
          {isHourly && onEditPickup && (
            <button
              type="button"
              onClick={onEditPickup}
              className="flex-shrink-0 mt-0.5 inline-flex items-center gap-1.5 px-3 h-8 rounded-xl border border-border bg-gray-50 hover:bg-primary/5 hover:border-primary/30 text-text-muted hover:text-primary text-[11px] font-semibold transition"
            >
              <Pencil className="w-3 h-3" />
              Edit
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Edit Car Sheet                                                       */
/* ------------------------------------------------------------------ */

function EditCarSheet({ open, cars, selectedCarId, onClose, onSelect }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center">
      <div
        className="bg-white w-full max-w-lg rounded-t-3xl shadow-2xl animate-fade-in-up max-h-[80dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border-light">
          <div>
            <p className="text-base font-bold text-text">Select a car</p>
            <p className="text-xs text-text-muted mt-0.5">Choose which car the driver will manage</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition"
          >
            <X className="w-4 h-4 text-text-muted" />
          </button>
        </div>

        {/* Car list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {cars.length === 0 && (
            <p className="text-sm text-text-muted text-center py-8">No cars found.</p>
          )}
          {cars.map((c) => {
            const isActive = c._id === selectedCarId;
            return (
              <button
                key={c._id}
                type="button"
                onClick={() => onSelect(c._id)}
                className={`w-full flex items-center gap-3 rounded-2xl border p-3 text-left transition ${
                  isActive
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-white hover:bg-gray-50'
                }`}
              >
                {/* Car thumbnail */}
                <div className="w-12 h-12 rounded-xl bg-gray-100 overflow-hidden flex items-center justify-center shrink-0">
                  {c.image ? (
                    <img src={c.image} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Car className="w-5 h-5 text-text-muted" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text truncate">
                    {getCarBrandName(c)} · {getCarModelName(c)}
                  </p>
                  <p className="text-[11px] font-mono text-text-secondary">{c.vehicleNumber}</p>
                </div>
                {/* Active check */}
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition ${
                    isActive ? 'border-primary bg-primary' : 'border-gray-300'
                  }`}
                >
                  {isActive && <CheckCircle2 className="w-3 h-3 text-white" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pickup Time Confirm Dialog                                           */
/* ------------------------------------------------------------------ */

function PickupTimeConfirmDialog({ open, onClose, onConfirm }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl animate-fade-in-up">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
            <CalendarClock className="w-5 h-5 text-amber-700" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-text">Change pickup time or hours?</p>
            <p className="text-sm text-text-secondary mt-1 leading-snug">
              You'll be taken back to select a new booking type, pickup time, and duration. Your
              current pickup location and car will be kept.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-gray-100 text-text-muted shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-2 mt-2">
          <button
            type="button"
            onClick={onConfirm}
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-primary text-white font-semibold py-3 text-sm hover:bg-primary-dark transition"
          >
            <CalendarClock className="w-4 h-4" />
            Yes, change it
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full inline-flex items-center justify-center rounded-2xl border border-border bg-white text-text font-semibold py-3 text-sm hover:bg-gray-50 transition"
          >
            Keep current time
          </button>
        </div>
      </div>
    </div>
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

/* ------------------------------------------------------------------ */
/* Conflict Error Dialog                                                */
/* ------------------------------------------------------------------ */

/**
 * Shown when the server rejects the booking due to a car time-conflict
 * (409) or insufficient lead time (422). Surfaces a clear title,
 * the server's exact message, and two context-aware action buttons so
 * the user can fix the issue without hunting around the UI.
 *
 * `type === 'car'`  → primary CTA opens the car-picker sheet.
 * `type === 'time'` → primary CTA opens the pickup-time confirm dialog.
 */
function ConflictErrorDialog({ error, onClose, onChangeCar, onChangePickup }) {
  if (!error) return null;
  const isCar = error.type === 'car';
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl animate-fade-in-up">
        {/* Icon + title row */}
        <div className="flex items-start gap-3 mb-1">
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${isCar ? 'bg-red-100' : 'bg-amber-100'}`}>
            <AlertTriangle className={`w-5 h-5 ${isCar ? 'text-red-600' : 'text-amber-700'}`} />
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <p className="text-base font-bold text-text">{error.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-gray-100 text-text-muted shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message */}
        <p className="text-sm text-text-secondary leading-snug mb-5 pl-14">
          {error.message}
        </p>

        {/* Actions */}
        <div className="space-y-2">
          {isCar ? (
            <>
              <button
                type="button"
                onClick={onChangeCar}
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-primary text-white font-semibold py-3 text-sm hover:bg-primary-dark transition"
              >
                <Car className="w-4 h-4" />
                Change car
              </button>
              <button
                type="button"
                onClick={onChangePickup}
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-white text-text font-semibold py-3 text-sm hover:bg-gray-50 transition"
              >
                <CalendarClock className="w-4 h-4" />
                Change pickup time instead
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onChangePickup}
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-primary text-white font-semibold py-3 text-sm hover:bg-primary-dark transition"
              >
                <CalendarClock className="w-4 h-4" />
                Change pickup time
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full inline-flex items-center justify-center rounded-2xl border border-border bg-white text-text font-semibold py-3 text-sm hover:bg-gray-50 transition"
              >
                Stay on this page
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* FoodStayCard — outstation food + stay arrangement toggle             */
/* ------------------------------------------------------------------ */

/**
 * Single all-or-nothing toggle for the customer arranging the
 * driver's food and stay themselves. When ON, the per-night
 * allowance is waived. The subtitle line is data-driven off the
 * latest estimate so the customer sees the exact saving they'd get
 * at a glance.
 */
function FoodStayCard({ customerArrangesAll, allowancePerNight, nights, onChange }) {
  const allowanceTotal = allowancePerNight * nights;
  return (
    <Card>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-bg flex items-center justify-center shrink-0">
          <HandCoins className="w-4 h-4 text-text-muted" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text">
            I will arrange the driver&rsquo;s food and stay
          </p>
          <p className="text-xs text-text-muted mt-0.5">
            {customerArrangesAll
              ? 'No allowance charged — you take care of meals and accommodation directly.'
              : nights > 0 && allowancePerNight > 0
                ? `We'll add ₹${allowancePerNight} × ${nights} night${nights === 1 ? '' : 's'} = ₹${allowanceTotal} as the driver's allowance (food + stay).`
                : 'No allowance applies on a same-day trip.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange(!customerArrangesAll)}
          className={`shrink-0 w-10 h-6 rounded-full transition-colors ${customerArrangesAll ? 'bg-primary' : 'bg-gray-300'} relative`}
          aria-pressed={customerArrangesAll}
          aria-label="I will arrange the driver's food and stay"
        >
          <span
            className={`absolute top-0.5 ${customerArrangesAll ? 'left-[18px]' : 'left-0.5'} w-5 h-5 bg-white rounded-full shadow transition-all`}
          />
        </button>
      </div>
      <p className="text-[11px] text-text-muted mt-3 pt-3 border-t border-border-light">
        Turn this on only if you can host the driver during the trip.
        Otherwise we&rsquo;ll add a per-night allowance covering their
        food and accommodation.
      </p>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* TollParkingAckDialog — outstation toll & parking acknowledgement     */
/* ------------------------------------------------------------------ */

/**
 * Outstation-only confirmation surfaced when the customer taps the
 * Pay CTA. Toll, parking and other route-specific incidentals are
 * paid by the customer directly to the driver as per actuals — they
 * are not part of this booking fare. Customer must explicitly
 * acknowledge before we create the booking.
 */
function TollParkingAckDialog({ open, submitting, onAccept, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl animate-fade-in-up">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5 text-amber-700" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-text">
              Toll &amp; parking are paid by you
            </p>
            <p className="text-sm text-text-secondary mt-1 leading-snug">
              Any tolls, parking, state-entry charges or other
              route-specific costs are <strong>not</strong> included in
              this fare. You&rsquo;ll pay them directly to the driver
              along the route as per actuals.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-xl hover:bg-gray-100 text-text-muted shrink-0"
            aria-label="Cancel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-2 mt-2">
          <button
            type="button"
            onClick={onAccept}
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-primary text-white font-semibold py-3 text-sm hover:bg-primary-dark transition disabled:opacity-60"
          >
            <ShieldCheck className="w-4 h-4" />
            I understand &mdash; continue to pay
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="w-full inline-flex items-center justify-center rounded-2xl border border-border bg-white text-text font-semibold py-3 text-sm hover:bg-gray-50 transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* OutstationCancellationPolicySummary                                  */
/* ------------------------------------------------------------------ */

/**
 * Compact, customer-facing summary of the outstation cancellation
 * policy. Renders on the review/confirm page so the customer knows
 * what they're committing to BEFORE they pay. Driven entirely off the
 * `cancellationPolicy.outstation` snapshot the estimate hands back —
 * no extra round-trip needed.
 */
function OutstationCancellationPolicySummary({ policy, dailyRate }) {
  const cfg = policy || {};
  const freeHours = Number(cfg.freeCancellationHoursBeforePickup ?? 24);
  const arrivedFeeMinDays = Math.max(0, Number(cfg.arrivedFeeMinDays ?? 1));
  const arrivedFloor = arrivedFeeMinDays * (Number(dailyRate) || 0);

  const describeFee = (type, amount, zeroLabel) => {
    const value = Number(amount) || 0;
    if (value <= 0) return zeroLabel;
    return type === 'percentage'
      ? `${value}% of the fare`
      : `\u20B9${value}`;
  };
  const beforeFee = describeFee(
    cfg.beforeWindowFeeType,
    cfg.beforeWindowFeeAmount,
    'no fee',
  );
  const preFee = describeFee(
    cfg.preArrivalFeeType,
    cfg.preArrivalFeeAmount,
    'no fee',
  );
  const arrivedFee = describeFee(
    cfg.arrivedFeeType,
    cfg.arrivedFeeAmount,
    'no fee',
  );

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-text">Cancellation policy</p>
          <p className="text-[11px] text-text-muted mt-0.5">
            Calculated from your pickup time. Refunds go straight back to
            your wallet.
          </p>
        </div>
      </div>

      <ul className="mt-3 space-y-2 text-[12px] text-text-secondary">
        <li className="flex gap-2">
          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
          <span>
            <strong className="text-text">More than {freeHours}h before pickup</strong>
            {' '}— {beforeFee === 'no fee'
              ? 'full refund, no cancellation fee.'
              : `${beforeFee} is deducted, the rest refunded.`}
          </span>
        </li>
        <li className="flex gap-2">
          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
          <span>
            <strong className="text-text">Within {freeHours}h, driver not yet arrived</strong>
            {' '}— {preFee === 'no fee'
              ? 'no cancellation fee.'
              : `${preFee} is deducted, the rest refunded.`}
          </span>
        </li>
        <li className="flex gap-2">
          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
          <span>
            <strong className="text-text">After the driver reaches pickup</strong>
            {' '}— {arrivedFee}
            {arrivedFloor > 0 ? (
              <>
                {' '}or <strong className="text-text">₹{Math.round(arrivedFloor)}</strong>{' '}
                ({arrivedFeeMinDays === 1
                  ? "one day\u2019s fare"
                  : `${arrivedFeeMinDays} days\u2019 fare`}), whichever is higher.
              </>
            ) : (
              <>.</>
            )}
          </span>
        </li>
      </ul>
    </div>
  );
}

export default ConfirmAndPayPage;

