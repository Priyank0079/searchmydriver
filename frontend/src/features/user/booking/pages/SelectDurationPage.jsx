import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Check, Loader2, Utensils, BedDouble } from 'lucide-react';
import Card from '../../../../components/Card';
import Button from '../../../../components/Button';
import { useCachedQuery } from '../../../../hooks/useCachedQuery';
import { buildCacheKey } from '../../../../store/lib/buildCacheKey';
import { useUserServicePricingsStore } from '../../../../store/user/useUserPricingStore';
import { SERVICE_TYPES } from '../../../../constants/serviceTypes';
import useBookingDraftStore from '../../../../store/user/useBookingDraftStore';

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
        onContinue={() => navigate('/user/book/review')}
      />
    );
  }

  return (
    <OutstationBranch
      pricing={servicePricing}
      draft={outstationDraft}
      onPatch={setOutstation}
      onContinue={() => navigate('/user/book/review')}
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
  const [startDate, setStartDate] = useState(draft.startDate || todayIso());
  const [endDate, setEndDate] = useState(draft.endDate || tomorrowIso());
  const [destination, setDestination] = useState(draft.destinationAddress || '');
  const [needsStay, setNeedsStay] = useState(draft.needsStay ?? true);
  const [needsFood, setNeedsFood] = useState(draft.needsFood ?? true);

  const days = useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const ms = end.getTime() - start.getTime();
    return Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)) + 1);
  }, [startDate, endDate]);
  const nights = Math.max(0, days - 1);

  const handleContinue = () => {
    onPatch({
      destinationAddress: destination.trim(),
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate).toISOString(),
      days,
      nights,
      needsStay,
      needsFood,
    });
    onContinue();
  };

  const dailyRate = pricing?.outstation?.dailyRate || 0;
  const provisionalTotal = dailyRate * days;

  return (
    <div className="flex-1 flex flex-col bg-bg min-h-dvh">
      <Header
        title="Trip details"
        subtitle="We use these to estimate your fare — the final bill is settled at the end."
        onBack={() => navigate(-1)}
      />

      <div className="flex-1 p-4 space-y-4">
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
              <label className="block text-xs font-semibold text-text-muted mb-2">Start date</label>
              <input
                type="date"
                value={startDate.slice(0, 10)}
                min={todayIso().slice(0, 10)}
                onChange={(e) => setStartDate(`${e.target.value}T08:00`)}
                className="w-full h-11 bg-gray-50 border border-border rounded-xl px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-2">End date</label>
              <input
                type="date"
                value={endDate.slice(0, 10)}
                min={startDate.slice(0, 10)}
                onChange={(e) => setEndDate(`${e.target.value}T20:00`)}
                className="w-full h-11 bg-gray-50 border border-border rounded-xl px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between bg-bg rounded-xl px-3 py-2">
            <span className="text-xs text-text-muted">Total</span>
            <span className="text-sm font-bold text-text">
              {days} day{days > 1 ? 's' : ''} · {nights} night{nights === 1 ? '' : 's'}
            </span>
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-text mb-3">Driver accommodation</h3>
          <ToggleRow
            icon={BedDouble}
            label="I will arrange the driver's stay"
            description={
              needsStay
                ? `We'll add ₹${pricing?.outstation?.stayChargePerNight || 0} × ${nights} night${nights === 1 ? '' : 's'} for hotel costs.`
                : "Great — no extra charge for stay."
            }
            value={!needsStay}
            onChange={(v) => setNeedsStay(!v)}
          />
          <div className="mt-3 pt-3 border-t border-border-light" />
          <ToggleRow
            icon={Utensils}
            label="I will arrange the driver's food"
            description={
              needsFood
                ? `We'll add ₹${pricing?.foodAllowance?.amount || 0} × ${days} day${days === 1 ? '' : 's'} for meals.`
                : 'Great — no extra charge for food.'
            }
            value={!needsFood}
            onChange={(v) => setNeedsFood(!v)}
          />
        </Card>
      </div>

      <Footer
        primaryLabel="Continue"
        priceLabel={`₹${provisionalTotal}`}
        priceHint="Provisional"
        onClick={handleContinue}
        disabled={!destination.trim() || !startDate || !endDate || days < 1}
      />
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

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T08:00`;
}

function tomorrowIso() {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T20:00`;
}

export default SelectDurationPage;
