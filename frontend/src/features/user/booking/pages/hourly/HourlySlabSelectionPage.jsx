import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Check, Loader2, AlertTriangle, X } from 'lucide-react';
import Button from '../../../../../components/Button';
import PageShell from '../../components/PageShell';
import FareCard from '../../components/FareCard';
import useFareEstimate from '../../hooks/useFareEstimate';
import useBookingDraftStore from '../../../../../store/user/useBookingDraftStore';
import useUserActiveBookingStore from '../../../../../store/user/useUserActiveBookingStore';
import {
  useUserServicePricingsStore,
} from '../../../../../store/user/useUserPricingStore';
import { useCachedQuery } from '../../../../../hooks/useCachedQuery';
import { buildCacheKey } from '../../../../../store/lib/buildCacheKey';
import { SERVICE_TYPES } from '../../../../../constants/serviceTypes';

const CUSTOM_KEY = '__custom__';

/**
 * Step 3 of the hourly booking flow.
 *
 *   Pick a slab (or custom hours) → see the live fare → confirm.
 *
 * The fare card refreshes live as the user toggles between options so
 * they never confirm without knowing the final amount.
 */
const HourlySlabSelectionPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const draft = useBookingDraftStore();
  const setHourly = useBookingDraftStore((s) => s.setHourly);
  const setFareEstimate = useBookingDraftStore((s) => s.setFareEstimate);
  const createBooking = useUserActiveBookingStore((s) => s.createBooking);

  // The searching page bounces the user here with `state.noDriversFound`
  // when the dispatcher exhausts every wave without an accept. We surface
  // it as a dismissible banner so the user can retune the duration and
  // submit again — the draft itself is preserved on purpose.
  const [noDriversBanner, setNoDriversBanner] = useState(
    !!location.state?.noDriversFound,
  );
  useEffect(() => {
    if (!location.state?.noDriversFound) return;
    // Strip the flag off the history entry so a refresh / back-nav doesn't
    // resurrect the banner.
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.state, location.pathname, navigate]);

  const { data: pricingList } = useCachedQuery(
    useUserServicePricingsStore,
    buildCacheKey('user-services-active'),
  );

  const pricing = useMemo(
    () => (Array.isArray(pricingList) ? pricingList.find((p) => p.serviceType === SERVICE_TYPES.HOURLY) : null),
    [pricingList],
  );

  // Bounce if the user landed without the prerequisites.
  useEffect(() => {
    if (draft.serviceType !== SERVICE_TYPES.HOURLY) {
      navigate('/user/book/hourly/type', { replace: true });
    } else if (!draft.pickup || !draft.carId) {
      navigate('/user/book/hourly/details', { replace: true });
    }
  }, [draft.serviceType, draft.pickup, draft.carId, navigate]);

  // Restore prior selection if the user came back from the next step.
  const initialKey = draft.hourly.isCustomDuration
    ? CUSTOM_KEY
    : draft.hourly.slabId || null;
  const [selectedKey, setSelectedKey] = useState(initialKey);
  const [customHours, setCustomHours] = useState(
    draft.hourly.isCustomDuration && draft.hourly.durationHours
      ? draft.hourly.durationHours
      : 6,
  );

  const slabs = useMemo(() => {
    const arr = pricing?.slabs ? [...pricing.slabs] : [];
    return arr.sort((a, b) => a.minHours - b.minHours);
  }, [pricing]);

  const customEnabled = !!pricing?.customHours?.enabled;
  const customMaxHours = pricing?.customHours?.maxHours || 0;
  const customRate = pricing?.customHours?.ratePerHour || 0;

  // The user's current pick, derived for the fare estimate.
  const currentSelection = useMemo(() => {
    if (!selectedKey) return null;
    if (selectedKey === CUSTOM_KEY) {
      return {
        isCustom: true,
        durationHours: Math.max(1, Number(customHours) || 1),
        slabId: null,
      };
    }
    const slab = slabs.find((s) => String(s._id) === String(selectedKey));
    if (!slab) return null;
    return {
      isCustom: false,
      durationHours: slab.maxHours,
      slabId: String(slab._id),
      slab,
    };
  }, [selectedKey, slabs, customHours]);

  // Fare estimation payload — debounced inside the hook.
  const estimatePayload = useMemo(() => {
    if (!currentSelection || !draft.hourly.scheduledStartAt) return null;
    return {
      serviceType: SERVICE_TYPES.HOURLY,
      slabId: currentSelection.isCustom ? null : currentSelection.slabId,
      bookedHours: currentSelection.durationHours,
      scheduledAt: draft.hourly.scheduledStartAt,
    };
  }, [currentSelection, draft.hourly.scheduledStartAt]);

  const { estimate, loading: estimating, error: estimateError } = useFareEstimate(estimatePayload, {
    onResult: (data) => setFareEstimate(data),
  });

  /* ---------------- Confirm ---------------- */

  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!currentSelection || submitting) return;
    setSubmitting(true);
    try {
      // Stamp the final hourly picks into the draft so `buildCreatePayload`
      // emits the right values.
      setHourly({
        durationHours: currentSelection.durationHours,
        slabId: currentSelection.isCustom ? null : currentSelection.slabId,
        isCustomDuration: currentSelection.isCustom,
      });
      // Tiny wait so the store update is committed before buildCreatePayload
      // reads back (zustand sync; we keep this safe with an immediate read).
      const payload = useBookingDraftStore.getState().buildCreatePayload();
      const { booking } = await createBooking(payload);
      if (booking) navigate('/user/book/searching');
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Could not create booking');
    } finally {
      setSubmitting(false);
    }
  };

  const ctaLabel = estimate?.fareBreakdown?.totalPayable
    ? `Confirm booking · ₹${estimate.fareBreakdown.totalPayable}`
    : 'Confirm booking';

  /* ---------------- Render ---------------- */

  return (
    <PageShell
      title="Pick a duration"
      subtitle="Hourly bookings — choose a slab or set custom hours."
      footer={
        <Button
          fullWidth
          loading={submitting}
          disabled={!currentSelection || estimating || !!estimateError}
          onClick={handleConfirm}
        >
          {ctaLabel}
        </Button>
      }
    >
      {!pricing ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
        </div>
      ) : (
        <div className="space-y-3">
          {noDriversBanner && (
            <div className="rounded-2xl bg-rose-50 border border-rose-200 px-3 py-3 flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 text-rose-700" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-rose-900">
                  No driver available right now
                </p>
                <p className="text-[12px] text-rose-800 leading-snug mt-0.5">
                  We couldn&apos;t find a driver for your last request. Adjust the duration if you like and try again &ndash; your pickup and car selection are saved.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setNoDriversBanner(false)}
                className="p-1.5 -mt-1 -mr-1 rounded-xl text-rose-700 hover:bg-rose-100"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div>
            <p className="text-[11px] uppercase tracking-wide text-text-muted font-semibold mb-2">
              Duration
            </p>
            <div className="space-y-2">
              {slabs.map((slab) => {
                const id = String(slab._id);
                return (
                  <SlabRow
                    key={id}
                    active={selectedKey === id}
                    title={slab.label || `Up to ${slab.maxHours} hours`}
                    subtitle={`Up to ${slab.maxHours} h${
                      pricing.extraHourCharge ? ` · extra ₹${pricing.extraHourCharge}/hr` : ''
                    }`}
                    price={`₹${slab.price}`}
                    onClick={() => setSelectedKey(id)}
                  />
                );
              })}

              {customEnabled && (
                <CustomRow
                  active={selectedKey === CUSTOM_KEY}
                  label={pricing.customHours?.label || 'Custom duration'}
                  rate={customRate}
                  maxHours={customMaxHours}
                  hours={customHours}
                  onSelect={() => setSelectedKey(CUSTOM_KEY)}
                  onHoursChange={setCustomHours}
                />
              )}
            </div>
          </div>

          {selectedKey && (
            <FareCard
              estimate={estimate}
              estimating={estimating}
              error={estimateError}
              footnote={
                estimate?.fareBreakdown?.foodAllowance
                  ? `Includes ₹${estimate.fareBreakdown.foodAllowance} food allowance (booking ≥ ${
                      estimate.fareBreakdown.foodThresholdHours || ''
                    } h).`
                  : null
              }
            />
          )}

        </div>
      )}
    </PageShell>
  );
};

/* ------------------------------------------------------------------ */

function SlabRow({ active, title, subtitle, price, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-2xl border p-3 flex items-center gap-3 transition ${
        active ? 'border-primary bg-primary/5' : 'border-border bg-white hover:bg-gray-50'
      }`}
    >
      <div
        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
          active ? 'border-primary bg-primary' : 'border-gray-300'
        }`}
      >
        {active && <Check className="w-3 h-3 text-white" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-text">{title}</p>
        <p className="text-[11px] text-text-muted">{subtitle}</p>
      </div>
      <p className="text-base font-bold text-text">{price}</p>
    </button>
  );
}

function CustomRow({ active, label, rate, maxHours, hours, onSelect, onHoursChange }) {
  return (
    <div
      className={`rounded-2xl border p-3 transition ${
        active ? 'border-primary bg-primary/5' : 'border-border bg-white'
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="w-full flex items-center gap-3 text-left"
      >
        <div
          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
            active ? 'border-primary bg-primary' : 'border-gray-300'
          }`}
        >
          {active && <Check className="w-3 h-3 text-white" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text">{label}</p>
          <p className="text-[11px] text-text-muted">
            ₹{rate}/hour
            {maxHours > 0 ? ` · up to ${maxHours} hours` : ''}
          </p>
        </div>
        {!active && <p className="text-xs font-semibold text-primary">Choose</p>}
      </button>

      {active && (
        <div className="mt-3 pt-3 border-t border-border-light">
          <label className="block text-xs font-semibold text-text-secondary mb-1.5">
            How many hours?
          </label>
          <div className="flex items-center gap-2">
            <Stepper
              value={hours}
              min={1}
              max={maxHours > 0 ? maxHours : 24}
              onChange={onHoursChange}
            />
            <p className="text-xs text-text-muted ml-2">
              ≈ ₹{Math.round((rate || 0) * (Number(hours) || 1))}{' '}
              <span className="text-[10px]">(before taxes & charges)</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Stepper({ value, min, max, onChange }) {
  const decrement = () => onChange(Math.max(min, Number(value) - 1));
  const increment = () => onChange(Math.min(max, Number(value) + 1));
  return (
    <div className="inline-flex items-center rounded-xl border border-border bg-white">
      <button
        type="button"
        onClick={decrement}
        disabled={Number(value) <= min}
        className="w-9 h-9 text-lg font-bold text-text-muted disabled:opacity-40 hover:bg-gray-50 rounded-l-xl"
      >
        −
      </button>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isNaN(n)) return;
          onChange(Math.min(max, Math.max(min, n)));
        }}
        className="w-12 h-9 text-center text-sm font-bold text-text bg-transparent border-x border-border focus:outline-none"
      />
      <button
        type="button"
        onClick={increment}
        disabled={Number(value) >= max}
        className="w-9 h-9 text-lg font-bold text-text-muted disabled:opacity-40 hover:bg-gray-50 rounded-r-xl"
      >
        +
      </button>
    </div>
  );
}

export default HourlySlabSelectionPage;
