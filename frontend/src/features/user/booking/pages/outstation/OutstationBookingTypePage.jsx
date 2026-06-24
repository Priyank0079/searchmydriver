import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, CalendarClock, ChevronRight, Check } from 'lucide-react';
import Button from '../../../../../components/Button';
import DateTimePickerField from '../../../../../components/inputs/DateTimePickerField';
import PageShell from '../../components/PageShell';
import useBookingDraftStore from '../../../../../store/user/useBookingDraftStore';
import { useCachedQuery } from '../../../../../hooks/useCachedQuery';
import { useUserServicePricingsStore } from '../../../../../store/user/useUserPricingStore';
import { SERVICE_TYPES } from '../../../../../constants/serviceTypes';
import {
  BOOKING_TYPE,
  BOOKING_TYPE_LABELS,
  BOOKING_TYPE_DESCRIPTIONS,
  TRIP_TYPE,
  TRIP_TYPE_LABELS,
  mergeScheduledDispatchConfig,
} from '../../../../../constants/bookingStatus';
import { formatPickupDateTime } from '../../../../../utils/datetime';

/**
 * Step 1 of the hourly booking flow.
 *
 *   "Do you need a driver right now, or later?"
 *
 *   - Instant   → pickup time defaults to now + 15 minutes (dispatch buffer).
 *   - Scheduled → user picks a future date+time; minimum is now +
 *     hourly pricing's `scheduledDispatch.MIN_SCHEDULED_LEAD_HOURS` so the
 *     emergency-pool safety net has room to fire. Reading the value from
 *     the live ServicePricing keeps the UI in lockstep with whatever the
 *     admin set in Settings → Service Pricing → Scheduled-ride dispatcher.
 *
 * Users with multiple cars can have parallel bookings, so we no longer
 * redirect into an existing active booking here — the home page surfaces
 * those as resume tiles instead.
 */
const OutstationBookingTypePage = () => {
  const navigate = useNavigate();
  const setServiceType = useBookingDraftStore((s) => s.setServiceType);
  const draftBookingType = useBookingDraftStore((s) => s.bookingType);
  const setBookingType = useBookingDraftStore((s) => s.setBookingType);
  const setOutstation = useBookingDraftStore((s) => s.setOutstation);

  // Pull the active service-pricing rows so we can use the admin's
  // per-service `scheduledDispatch` knobs (min lead time, etc.) for the
  // date-picker constraint. Cached across the whole booking flow.
  const { data: pricingRows } = useCachedQuery(
    useUserServicePricingsStore,
    'user-pricing-services',
  );
  const dispatchConfig = useMemo(() => {
    const outstationPricing = (pricingRows || []).find(
      (p) => p.serviceType === SERVICE_TYPES.OUTSTATION,
    );
    return mergeScheduledDispatchConfig(outstationPricing?.scheduledDispatch);
  }, [pricingRows]);

  const [selected, setSelected] = useState(draftBookingType || null);
  // Blank-by-default — the scheduled card stays empty until the user
  // taps the picker. No more "tomorrow 9 AM" surprise prefill.
  const [scheduledAt, setScheduledAt] = useState(null);
  const draftTripType = useBookingDraftStore((s) => s.outstation?.tripType);
  const [tripType, setTripType] = useState(draftTripType || TRIP_TYPE.ROUND_TRIP);

  // Make sure the service is locked to hourly the moment the user opens this
  // screen — keeps the rest of the flow consistent if they arrived via a
  // deep link instead of the home tile.
  useEffect(() => {
    setServiceType(SERVICE_TYPES.OUTSTATION);
  }, [setServiceType]);

  const minLeadHours = dispatchConfig.MIN_SCHEDULED_LEAD_HOURS;
  // Lazy-snapshot the wall clock so `Date.now()` stays out of render
  // (react-hooks/purity) — the floor is stable for the mount, the
  // backend re-validates against the live clock on Continue.
  const [nowAnchorMs] = useState(() => Date.now());
  const minScheduledDate = useMemo(
    () => new Date(nowAnchorMs + minLeadHours * 60 * 60_000),
    [nowAnchorMs, minLeadHours],
  );
  const handleContinue = () => {
    if (!selected) return;
    setBookingType(selected);
    if (selected === BOOKING_TYPE.INSTANT) {
      // 15 min buffer so dispatch has time to find a driver before the
      // "ride starts" countdown is meaningful.
      setOutstation({ pickupAt: new Date(Date.now() + 15 * 60_000).toISOString(), tripType });
    } else {
      const iso = new Date(scheduledAt).toISOString();
      setOutstation({ pickupAt: iso, tripType });
    }
    navigate('/user/book/outstation/variants');
  };

  const canContinue =
    selected === BOOKING_TYPE.INSTANT ||
    (selected === BOOKING_TYPE.SCHEDULED &&
      scheduledAt &&
      new Date(scheduledAt).getTime() >= minScheduledDate.getTime());

  return (
    <PageShell
      title="When do you need a driver?"
      subtitle="Outstation bookings"
      footer={
        <Button fullWidth disabled={!canContinue} onClick={handleContinue}>
          Continue
        </Button>
      }
    >
      <div className="space-y-3">
        <Option
          icon={Zap}
          accent="amber"
          active={selected === BOOKING_TYPE.INSTANT}
          title={BOOKING_TYPE_LABELS[BOOKING_TYPE.INSTANT]}
          description={BOOKING_TYPE_DESCRIPTIONS[BOOKING_TYPE.INSTANT]}
          onClick={() => setSelected(BOOKING_TYPE.INSTANT)}
        >
          {selected === BOOKING_TYPE.INSTANT && (
            <div className="pt-3 border-t border-border-light">
              <p className="text-sm font-medium mb-2 text-text">Trip type</p>
              <div className="flex gap-3">
                {Object.values(TRIP_TYPE).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setTripType(type); }}
                    className={`flex-1 py-2 px-3 rounded-xl border text-sm font-bold transition ${
                      tripType === type
                        ? 'border-gray-900 bg-gray-900 text-white'
                        : 'border-border text-text-muted hover:border-gray-300'
                    }`}
                  >
                    {TRIP_TYPE_LABELS[type]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Option>
        <Option
          icon={CalendarClock}
          accent="indigo"
          active={selected === BOOKING_TYPE.SCHEDULED}
          title={BOOKING_TYPE_LABELS[BOOKING_TYPE.SCHEDULED]}
          description={BOOKING_TYPE_DESCRIPTIONS[BOOKING_TYPE.SCHEDULED]}
          onClick={() => setSelected(BOOKING_TYPE.SCHEDULED)}
        >
          {selected === BOOKING_TYPE.SCHEDULED && (
            <div className="pt-3 border-t border-border-light space-y-4">
              <div>
                <p className="text-sm font-medium mb-2 text-text">Trip type</p>
                <div className="flex gap-3">
                  {Object.values(TRIP_TYPE).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setTripType(type); }}
                      className={`flex-1 py-2 px-3 rounded-xl border text-sm font-bold transition ${
                        tripType === type
                          ? 'border-gray-900 bg-gray-900 text-white'
                          : 'border-border text-text-muted hover:border-gray-300'
                      }`}
                    >
                      {TRIP_TYPE_LABELS[type]}
                    </button>
                  ))}
                </div>
              </div>
              <DateTimePickerField
                label="Pickup date & time"
                icon={CalendarClock}
                value={scheduledAt}
                onChange={setScheduledAt}
                minDate={minScheduledDate}
                placeholder="Tap to choose pickup"
                helper={`Earliest available is ${formatPickupDateTime(minScheduledDate)} — we need at least ${minLeadHours} hour${minLeadHours === 1 ? '' : 's'} lead time for scheduled rides.`}
                sheetTitle="Pickup date & time"
              />
            </div>
          )}
        </Option>
      </div>
    </PageShell>
  );
};

/* ------------------------------------------------------------------ */

function Option({ icon: Icon, accent, active, title, description, onClick, children }) {
  const ring = active ? 'border-primary bg-primary/5' : 'border-border bg-white hover:bg-gray-50';
  const accentBg = accent === 'amber' ? 'bg-amber-100' : 'bg-indigo-100';
  const accentColor = accent === 'amber' ? 'text-amber-700' : 'text-indigo-700';
  return (
    <div className={`w-full text-left rounded-2xl border transition ${ring}`}>
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => e.key === 'Enter' && onClick()}
        className="p-4 flex items-start gap-3 cursor-pointer outline-none rounded-2xl"
      >
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${accentBg}`}
        >
          <Icon className={`w-5 h-5 ${accentColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-base font-bold text-text">{title}</p>
          </div>
          <p className="text-xs text-text-muted mt-0.5">{description}</p>
        </div>
        <div
          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-1 ${
            active ? 'border-primary bg-primary' : 'border-gray-300'
          }`}
        >
          {active ? <Check className="w-3 h-3 text-white" /> : <ChevronRight className="w-3 h-3 text-transparent" />}
        </div>
      </div>
      {children && <div className="px-4 pb-4 -mt-1">{children}</div>}
    </div>
  );
}

export default OutstationBookingTypePage;
