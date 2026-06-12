import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  Check,
  Loader2,
  HandCoins,
  RefreshCw,
  CalendarRange,
  AlertCircle,
} from 'lucide-react';
import Card from '../../../../components/Card';
import Button from '../../../../components/Button';
import { useCachedQuery } from '../../../../hooks/useCachedQuery';
import { buildCacheKey } from '../../../../store/lib/buildCacheKey';
import { useUserServicePricingsStore } from '../../../../store/user/useUserPricingStore';
import { SERVICE_TYPES } from '../../../../constants/serviceTypes';
import useBookingDraftStore from '../../../../store/user/useBookingDraftStore';
import {
  computeOutstationDuration,
  defaultPickupInputValue,
  defaultReturnInputValue,
  toDateTimeInputValue,
} from '../../../../utils/outstationSchedule';

/**
 * Step 3 — pick duration (hourly) or date range (outstation).
 *
 * Branches at the top based on the draft's serviceType. Both branches end up
 * pushing the relevant fields back to the draft store and navigating to
 * review.
 */
const SelectDurationPage = () => {
  const navigate = useNavigate();
  const serviceType = useBookingDraftStore((s) => s.serviceType);
  const hourlyDraft = useBookingDraftStore((s) => s.hourly);
  const outstationDraft = useBookingDraftStore((s) => s.outstation);
  const setHourly = useBookingDraftStore((s) => s.setHourly);
  const setOutstation = useBookingDraftStore((s) => s.setOutstation);

  const { data, loading } = useCachedQuery(
    useUserServicePricingsStore,
    buildCacheKey('user-services-active'),
  );
  const servicePricing = useMemo(() => {
    const list = Array.isArray(data) ? data : [];
    return list.find((s) => s.serviceType === serviceType) || null;
  }, [data, serviceType]);

  useEffect(() => {
    if (!serviceType) navigate('/user/book/service', { replace: true });
  }, [serviceType, navigate]);

  if (loading && !servicePricing) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bg min-h-dvh">
        <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
      </div>
    );
  }

  if (serviceType === SERVICE_TYPES.HOURLY) {
    return (
      <HourlyBranch
        pricing={servicePricing}
        draft={hourlyDraft}
        onPatch={setHourly}
        onContinue={() => navigate('/user/book/confirm')}
      />
    );
  }

  return (
    <OutstationBranch
      pricing={servicePricing}
      draft={outstationDraft}
      onPatch={setOutstation}
      onContinue={() => navigate('/user/book/confirm')}
    />
  );
};

/* ------------------------------------------------------------------ */
/* Hourly branch                                                       */
/* ------------------------------------------------------------------ */

function HourlyBranch({ pricing, draft, onPatch, onContinue }) {
  const navigate = useNavigate();
  const slabs = pricing?.slabs || [];
  const [selectedSlabId, setSelectedSlabId] = useState(draft.slabId || slabs[0]?._id);
  const [scheduledStartAt, setScheduledStartAt] = useState(
    draft.scheduledStartAt || defaultIsoForInput(),
  );

  const selectedSlab = slabs.find((s) => s._id === selectedSlabId);

  const handleContinue = () => {
    if (!selectedSlab) return;
    onPatch({
      slabId: selectedSlab._id,
      durationHours: selectedSlab.maxHours || selectedSlab.minHours,
      scheduledStartAt: new Date(scheduledStartAt).toISOString(),
    });
    onContinue();
  };

  return (
    <div className="flex-1 flex flex-col bg-bg min-h-dvh">
      <Header
        title="When do you need the driver?"
        subtitle="Choose a slab — extra hours are billed at the per-hour rate."
        onBack={() => navigate(-1)}
      />

      <div className="flex-1 p-4 space-y-4">
        <Card>
          <label className="block text-xs font-semibold text-text-muted mb-2">Pickup time</label>
          <input
            type="datetime-local"
            value={scheduledStartAt}
            min={defaultIsoForInput()}
            onChange={(e) => setScheduledStartAt(e.target.value)}
            className="w-full h-11 bg-gray-50 border border-border rounded-xl px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </Card>

        <div className="space-y-3">
          {slabs.map((slab, idx) => {
            const isSelected = slab._id === selectedSlabId;
            return (
              <Card
                key={slab._id}
                onClick={() => setSelectedSlabId(slab._id)}
                hoverable
                className={`animate-fade-in-up ${isSelected ? 'ring-2 ring-primary' : ''}`}
                style={{ animationDelay: `${idx * 0.06}s` }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      isSelected ? 'bg-primary/15' : 'bg-gray-100'
                    }`}
                  >
                    <Clock className={`w-5 h-5 ${isSelected ? 'text-primary' : 'text-text-muted'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm text-text">
                      {slab.label || `${slab.minHours}–${slab.maxHours} hours`}
                    </h3>
                    <p className="text-xs text-text-muted mt-0.5">
                      Up to {slab.maxHours} hours · extra ₹{pricing?.extraHourCharge || 0}/hr
                    </p>
                  </div>
                  <span className="text-sm font-bold text-text">₹{slab.price}</span>
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      isSelected ? 'border-primary bg-primary' : 'border-gray-300'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      <Footer
        primaryLabel="Continue"
        priceLabel={selectedSlab ? `₹${selectedSlab.price}` : '—'}
        priceHint="Starts at"
        onClick={handleContinue}
        disabled={!selectedSlab || !scheduledStartAt}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Outstation branch                                                   */
/* ------------------------------------------------------------------ */

function OutstationBranch({ pricing, draft, onPatch, onContinue }) {
  const navigate = useNavigate();
  const initialPickup =
    toDateTimeInputValue(draft.pickupAt || draft.startDate) ||
    defaultPickupInputValue();
  const initialReturn =
    toDateTimeInputValue(draft.expectedReturnAt || draft.endDate) ||
    defaultReturnInputValue(initialPickup);

  const [pickupAt, setPickupAt] = useState(initialPickup);
  const [expectedReturnAt, setExpectedReturnAt] = useState(initialReturn);
  const [destination, setDestination] = useState(draft.destinationAddress || '');
  // Single all-or-nothing toggle: the customer commits to arranging
  // BOTH the driver's food AND stay themselves to skip the per-night
  // allowance. We mirror the boolean into both `needsFood` and
  // `needsStay` for the backend (it AND's them in the engine — both
  // must be `true` for the allowance to be waived).
  const initialArranges = draft.needsFood === true && draft.needsStay === true;
  const [customerArrangesAll, setCustomerArrangesAll] = useState(initialArranges);

  // Days = number of distinct calendar dates the trip spans; nights =
  // days \u2212 1. Shared with the backend so the provisional fare
  // here matches the server's authoritative breakdown on Review.
  const { days, nights } = useMemo(
    () => computeOutstationDuration(pickupAt, expectedReturnAt),
    [pickupAt, expectedReturnAt],
  );

  // Auto-bump return when pickup pushes past it; keeps the diff
  // non-negative without forcing a separate validation message.
  const onPickupChange = (value) => {
    setPickupAt(value);
    if (
      value &&
      expectedReturnAt &&
      new Date(value).getTime() >= new Date(expectedReturnAt).getTime()
    ) {
      setExpectedReturnAt(defaultReturnInputValue(value));
    }
  };

  const handleContinue = () => {
    const pickupIso = new Date(pickupAt).toISOString();
    const returnIso = new Date(expectedReturnAt).toISOString();
    // Both flags flip together so the backend's AND check waives the
    // allowance only when the customer commits to arranging
    // everything (food AND stay). Convention: `true` here = "this
    // need is arranged by the customer" → no allowance.
    onPatch({
      destinationAddress: destination.trim(),
      pickupAt: pickupIso,
      expectedReturnAt: returnIso,
      startDate: pickupIso,
      endDate: returnIso,
      days,
      nights,
      needsStay: customerArrangesAll,
      needsFood: customerArrangesAll,
    });
    onContinue();
  };

  // Inline provisional breakdown — same math the server-side
  // calculateOutstationFare uses (pre-platform subtotal). The
  // customer sees the full breakdown with GST + service charge on
  // the Review screen.
  const o = pricing?.outstation || {};
  const dailyRate = Number(o.dailyRate) || 0;
  const allowancePerNight = Number(o.allowancePerNight) || 0;

  const lineDaily = dailyRate * days;
  const lineAllowance = customerArrangesAll ? 0 : allowancePerNight * nights;
  const provisionalTotal = lineDaily + lineAllowance;

  return (
    <div className="flex-1 flex flex-col bg-bg min-h-dvh">
      <Header
        title="Round trip details"
        subtitle="Pick your travel window — we drop you back at pickup at the end."
        onBack={() => navigate(-1)}
      />

      <div className="flex-1 p-4 space-y-4">
        <div className="rounded-2xl bg-primary/5 border border-primary/20 px-3 py-2 flex items-start gap-2">
          <RefreshCw className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <p className="text-[12px] leading-snug text-primary/90">
            <strong className="font-semibold">Round trip:</strong> the driver
            stays with you the whole trip and brings you back to your pickup
            on day {days}.
          </p>
        </div>

        <Card>
          <label className="block text-xs font-semibold text-text-muted mb-2">Destination</label>
          <input
            type="text"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="Where are you headed?"
            className="w-full h-11 bg-gray-50 border border-border rounded-xl px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </Card>

        <Card>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-2">
                Pickup time
              </label>
              <input
                type="datetime-local"
                value={pickupAt}
                min={defaultPickupInputValue()}
                onChange={(e) => onPickupChange(e.target.value)}
                className="w-full h-11 bg-gray-50 border border-border rounded-xl px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-2">
                Expected return
              </label>
              <input
                type="datetime-local"
                value={expectedReturnAt}
                min={pickupAt}
                onChange={(e) => setExpectedReturnAt(e.target.value)}
                className="w-full h-11 bg-gray-50 border border-border rounded-xl px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between bg-bg rounded-xl px-3 py-2">
            <span className="text-xs text-text-muted inline-flex items-center gap-1.5">
              <CalendarRange className="w-3.5 h-3.5" />
              Trip length
            </span>
            <span className="text-sm font-bold text-text">
              {days} day{days > 1 ? 's' : ''} · {nights} night{nights === 1 ? '' : 's'}
            </span>
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-text mb-3">
            Driver food &amp; stay
          </h3>
          <ToggleRow
            icon={HandCoins}
            label="I will arrange the driver's food and stay"
            description={
              customerArrangesAll
                ? 'No allowance charged \u2014 you take care of meals and accommodation directly.'
                : nights > 0 && allowancePerNight > 0
                ? `We'll add \u20B9${allowancePerNight} \u00d7 ${nights} night${nights === 1 ? '' : 's'} = \u20B9${lineAllowance} as the driver's allowance (food + stay).`
                : 'No allowance applies on a same-day trip.'
            }
            value={customerArrangesAll}
            onChange={(v) => setCustomerArrangesAll(v)}
          />
          <p className="text-[11px] text-text-muted mt-3 pt-3 border-t border-border-light">
            Turn this on only if you can host the driver for the trip.
            Otherwise we&rsquo;ll add a per-night allowance covering
            their food and accommodation.
          </p>
        </Card>

        {/* Provisional breakdown so the user sees how the number is
            built before they reach the Review page (which shows the
            authoritative server-computed breakdown). */}
        <Card>
          <h3 className="text-sm font-semibold text-text mb-3">
            Provisional fare
          </h3>
          <div className="space-y-1.5 text-sm">
            <MiniRow
              label={`Daily rate \u00d7 ${days} day${days === 1 ? '' : 's'}`}
              value={`\u20B9${lineDaily}`}
            />
            {lineAllowance > 0 && (
              <MiniRow
                label={`Driver allowance \u00d7 ${nights} night${nights === 1 ? '' : 's'}`}
                value={`\u20B9${lineAllowance}`}
              />
            )}
            <div className="h-px bg-border-light my-1" />
            <MiniRow
              label="Subtotal (excl. taxes)"
              value={`\u20B9${provisionalTotal}`}
              highlight
            />
            <p className="text-[11px] text-text-muted">
              Service charge and GST are added on the next screen.
            </p>
          </div>
        </Card>

        {/* Toll & parking are paid by the customer directly to the
            driver \u2014 not part of the booking fare. Surfaced here
            so there are no surprises during the trip. */}
        <div className="rounded-2xl bg-amber-50 border border-amber-200 px-3 py-2.5 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
          <p className="text-[12px] leading-snug text-amber-900">
            <strong className="font-semibold">Toll &amp; parking:</strong>
            {' '}
            charges along the route are paid by you directly to the
            driver as per actuals. They are not added to this booking
            fare.
          </p>
        </div>
      </div>

      <Footer
        primaryLabel="Continue"
        priceLabel={`\u20B9${provisionalTotal}`}
        priceHint="Provisional"
        onClick={handleContinue}
        disabled={!destination.trim() || !pickupAt || !expectedReturnAt || days < 1}
      />
    </div>
  );
}

function MiniRow({ label, value, highlight }) {
  return (
    <div
      className={`flex items-center justify-between ${
        highlight ? 'text-text font-semibold' : 'text-text-secondary'
      }`}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */

function Header({ title, subtitle, onBack }) {
  return (
    <div className="bg-white px-4 pt-4 pb-4 shadow-sm">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 -ml-2 rounded-xl hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5 text-text" />
        </button>
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-text truncate">{title}</h1>
          <p className="text-xs text-text-muted">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

function Footer({ primaryLabel, priceLabel, priceHint, onClick, disabled }) {
  return (
    <div className="p-4 bg-white border-t border-border-light">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-text-muted">{priceHint}</span>
        <span className="text-lg font-bold text-text">{priceLabel}</span>
      </div>
      <Button fullWidth disabled={disabled} onClick={onClick}>
        {primaryLabel}
      </Button>
    </div>
  );
}

function ToggleRow({ icon: Icon, label, description, value, onChange }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-xl bg-bg flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-text-muted" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text">{label}</p>
        <p className="text-xs text-text-muted mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`shrink-0 w-10 h-6 rounded-full transition-colors ${value ? 'bg-primary' : 'bg-gray-300'} relative`}
        aria-pressed={value}
      >
        <span
          className={`absolute top-0.5 ${value ? 'left-[18px]' : 'left-0.5'} w-5 h-5 bg-white rounded-full shadow transition-all`}
        />
      </button>
    </div>
  );
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function defaultIsoForInput() {
  const d = new Date(Date.now() + 30 * 60 * 1000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default SelectDurationPage;
