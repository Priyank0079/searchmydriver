import { useState } from 'react';
import toast from 'react-hot-toast';
import { Save } from 'lucide-react';
import api from '../../../../utils/api';
import Modal from '../../../../components/Modal';
import Input from '../../../../components/Input';
import Button from '../../../../components/Button';
import Toggle from '../../../../components/Toggle';
import {
  SERVICE_TYPES,
  SERVICE_TYPE_LABELS,
  SERVICE_TYPE_DESCRIPTIONS,
} from '../../../../constants/serviceTypes';
import SlabsEditor from './SlabsEditor';
import OutstationFieldsEditor from './OutstationFieldsEditor';
import FarePreview from './FarePreview';

const buildDefaultForm = (serviceType) => ({
  serviceType,
  name: SERVICE_TYPE_LABELS[serviceType] || '',
  description: SERVICE_TYPE_DESCRIPTIONS[serviceType] || '',
  icon: '',

  // Hourly
  slabs: [],
  extraHourCharge: serviceType === SERVICE_TYPES.HOURLY ? 150 : 0,
  waitingCharge: {
    freeWaitingMinutes: 15,
    chargePerMinute: 2,
    noShowPromptMinutes: 15,
    noShowGraceMinutes: 5,
    maxNoShowPrompts: 2,
    maxBillableMinutes: 45,
  },
  customHours: {
    enabled: false,
    maxHours: 24,
    ratePerHour: 0,
    label: 'Custom duration',
  },

  // Outstation
  outstation: {
    dailyRate: serviceType === SERVICE_TYPES.OUTSTATION ? 1500 : 0,
    kmIncludedPerDay: 0,
    extraKmRate: 0,
    nightHaltCharge: serviceType === SERVICE_TYPES.OUTSTATION ? 400 : 0,
    stayChargePerNight: serviceType === SERVICE_TYPES.OUTSTATION ? 800 : 0,
    minDays: 1,
    maxDays: 0,
  },

  // Shared extras
  nightCharge: {
    enabled: false,
    startTime: '22:00',
    endTime: '06:00',
    type: 'flat',
    amount: 0,
    // When > 0, any booking whose duration crosses this many hours
    // gets the night charge regardless of pickup time.
    thresholdHours: 0,
  },
  // Toll & parking is no longer admin-tunable — the field stays in the
  // schema (default false) but isn't surfaced in the admin UI.
  tollParkingEnabled: false,
  foodAllowance: {
    enabled: serviceType === SERVICE_TYPES.OUTSTATION,
    // Outstation keeps a per-day ₹ amount. Hourly bookings never bill
    // for food — the threshold gates a mandatory "I'll feed the driver"
    // checkbox on the customer's booking screen instead.
    amount: 0,
    thresholdHours: 4,
    userOptOut: false,
  },
  // Hourly stay allowance (mirrors foodAllowance). Outstation uses the
  // dedicated `outstation.nightHaltCharge` / `stayChargePerNight` knobs.
  stayAllowance: {
    enabled: false,
    amount: 0,
    thresholdHours: 8,
    userOptOut: true,
  },

  // Platform
  serviceChargePercent: 0,
  gstPercent: 18,
  platformCommissionPercent: 20,

  // Policies
  cancellation: {
    flatFeeAfterAssignment: 100,
    // Type + amount lets the admin pick flat ₹ or % for the post-arrival
    // fee. Defaults: flat ₹250 — back-compat with the prior single-flat
    // shape (`flatFeeAfterArrival`).
    arrivedFeeType: 'flat',
    arrivedFeeAmount: 250,
    // Cut of every cancellation fee that goes to the driver who was
    // mobilised. The rest flows into the platform's revenue ledger.
    driverSharePercent: 0,
    driverCancellationPenalty: 50,
    // Grace window + daily quota for driver cancellations. Inside the
    // window AND while chances remain → no rupee penalty (just a
    // chance burned). After either, the penalty applies. Both are
    // admin-tunable so the policy can be relaxed/tightened per service.
    driverGraceMinutes: 2,
    driverDailyFreeCancellations: 3,
  },
  // Scheduled-ride dispatcher tuning. Mirrors `SCHEDULED_BOOKING` in
  // backend constants. Hourly-only — the modal hides this section for
  // outstation since outstation has no schedule queue today.
  scheduledDispatch: {
    MORNING_START_HOUR: 6,
    MORNING_END_HOUR: 10,
    SHORT_WINDOW_HOURS: 6,
    LONG_LEAD_HOURS: 4,
    LEAD_SCHEDULE_HOUR: 18,
    EMERGENCY_POOL_MINUTES: 120,
    RETRY_DELAY_MINUTES: 5,
    RIDE_BUFFER_MINUTES: 30,
    MIN_SCHEDULED_LEAD_HOURS: 2,
    REMINDER_OFFSETS_MINUTES: [60, 15],
  },
  isActive: true,
  sortOrder: 0,
});

const buildFormFromExisting = (existing) => {
  const base = buildDefaultForm(existing.serviceType);
  return {
    ...base,
    ...existing,
    outstation: { ...base.outstation, ...(existing.outstation || {}) },
    waitingCharge: { ...base.waitingCharge, ...(existing.waitingCharge || {}) },
    nightCharge: { ...base.nightCharge, ...(existing.nightCharge || {}) },
    foodAllowance: { ...base.foodAllowance, ...(existing.foodAllowance || {}) },
    stayAllowance: { ...base.stayAllowance, ...(existing.stayAllowance || {}) },
    customHours: { ...base.customHours, ...(existing.customHours || {}) },
    cancellation: { ...base.cancellation, ...(existing.cancellation || {}) },
    scheduledDispatch: {
      ...base.scheduledDispatch,
      ...(existing.scheduledDispatch || {}),
    },
  };
};

const Section = ({ title, subtitle, children }) => (
  <section className="space-y-3">
    <div>
      <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
    </div>
    {children}
  </section>
);

const ServicePricingModal = ({ isOpen, onClose, serviceType, existing, onSaved }) => {
  // Parent passes a `key` based on serviceType+existing so this component remounts
  // (and re-initialises form) whenever the user opens the modal for a different service.
  const [form, setForm] = useState(() =>
    existing ? buildFormFromExisting(existing) : buildDefaultForm(serviceType),
  );
  const [submitting, setSubmitting] = useState(false);

  const isHourly = form.serviceType === SERVICE_TYPES.HOURLY;
  const isOutstation = form.serviceType === SERVICE_TYPES.OUTSTATION;

  const update = (patch) => setForm((prev) => ({ ...prev, ...patch }));
  const updateNested = (key, patch) =>
    setForm((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));

  const handleSave = async () => {
    if (!form.name?.trim()) {
      toast.error('Name is required');
      return;
    }
    if (isHourly && !form.slabs?.length) {
      toast.error('Add at least one slab for hourly pricing');
      return;
    }
    if (isOutstation && !(form.outstation?.dailyRate > 0)) {
      toast.error('Daily rate is required for outstation pricing');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/admin/pricing/services', form);
      toast.success('Pricing saved');
      onSaved?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save pricing');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Configure ${SERVICE_TYPE_LABELS[serviceType]}`}
      size="3xl"
    >
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 p-5">
        <div className="space-y-6">
          {/* Basic info */}
          <Section title="Basics" subtitle="Visible name and short description for the booking UI.">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                label="Display name"
                value={form.name}
                onChange={(e) => update({ name: e.target.value })}
                required
              />
              <Input
                label="Icon (lucide name)"
                placeholder={isHourly ? 'Clock' : 'Mountain'}
                value={form.icon}
                onChange={(e) => update({ icon: e.target.value })}
              />
            </div>
            <Input
              label="Description"
              value={form.description}
              onChange={(e) => update({ description: e.target.value })}
            />
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
              <span className="text-sm font-semibold">Active</span>
              <Toggle checked={form.isActive} onChange={(v) => update({ isActive: v })} />
            </div>
          </Section>

          {/* Conditional: Hourly slabs OR Outstation fields */}
          {isHourly && (
            <>
              <SlabsEditor
                slabs={form.slabs}
                onChange={(slabs) => update({ slabs })}
              />
              <Section title="Hourly extras" subtitle="Applied during the trip.">
                <Input
                  label="Extra hour charge (₹ per hour after slab)"
                  type="number"
                  min={0}
                  value={form.extraHourCharge}
                  onChange={(e) => update({ extraHourCharge: Number(e.target.value) })}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input
                    label="Free waiting (min)"
                    type="number"
                    min={0}
                    value={form.waitingCharge.freeWaitingMinutes}
                    onChange={(e) =>
                      updateNested('waitingCharge', {
                        freeWaitingMinutes: Number(e.target.value),
                      })
                    }
                  />
                  <Input
                    label="Waiting charge (₹/min after free)"
                    type="number"
                    min={0}
                    value={form.waitingCharge.chargePerMinute}
                    onChange={(e) =>
                      updateNested('waitingCharge', {
                        chargePerMinute: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                  <Input
                    label="Re-prompt interval (min)"
                    type="number"
                    min={1}
                    value={form.waitingCharge.noShowPromptMinutes}
                    onChange={(e) =>
                      updateNested('waitingCharge', {
                        noShowPromptMinutes: Number(e.target.value),
                      })
                    }
                  />
                  <Input
                    label="Final grace window (min)"
                    type="number"
                    min={1}
                    value={form.waitingCharge.noShowGraceMinutes}
                    onChange={(e) =>
                      updateNested('waitingCharge', {
                        noShowGraceMinutes: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                  <Input
                    label="Max re-prompts (before final)"
                    type="number"
                    min={0}
                    max={5}
                    value={form.waitingCharge.maxNoShowPrompts}
                    onChange={(e) =>
                      updateNested('waitingCharge', {
                        maxNoShowPrompts: Number(e.target.value),
                      })
                    }
                  />
                  <Input
                    label="Max billable wait (min)"
                    type="number"
                    min={0}
                    value={form.waitingCharge.maxBillableMinutes}
                    onChange={(e) =>
                      updateNested('waitingCharge', {
                        maxBillableMinutes: Number(e.target.value),
                      })
                    }
                  />
                </div>
                {/*
                  Buffer + cadence preview. The buffer (= maxBillable ×
                  perMinute) is debited from the user's wallet at booking
                  creation; only the actually-consumed portion stays with
                  the platform, the rest is refunded to the wallet at
                  trip-end. The worst-case minutes calculation must stay
                  in lockstep with the backend validator in
                  pricing.service.js → validateWaitingCharge.
                */}
                {(() => {
                  const wc = form.waitingCharge || {};
                  const promptM = Number(wc.noShowPromptMinutes) || 0;
                  const graceM = Number(wc.noShowGraceMinutes) || 0;
                  const maxP = Number(wc.maxNoShowPrompts) || 0;
                  const maxB = Number(wc.maxBillableMinutes) || 0;
                  const perMin = Number(wc.chargePerMinute) || 0;
                  const worstCase = (maxP + 1) * promptM + graceM;
                  const buffer = Math.round(maxB * perMin * 100) / 100;
                  const ok = maxB >= worstCase;
                  return (
                    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] leading-snug">
                      <div className="flex items-center justify-between font-semibold text-text">
                        <span>Pre-collected buffer</span>
                        <span>₹{buffer.toFixed(2)}</span>
                      </div>
                      <p className="text-text-muted mt-1">
                        Free wait {wc.freeWaitingMinutes || 0} min → reminder
                        every {promptM} min (up to {maxP} re-prompts) →
                        final {graceM} min grace → auto-complete. Worst-case
                        billable wait: <span className="font-medium text-text">{worstCase} min</span>.
                      </p>
                      <p
                        className={`mt-1 ${
                          ok
                            ? 'text-emerald-700'
                            : 'text-rose-600 font-semibold'
                        }`}
                      >
                        {ok
                          ? `Buffer covers worst case (${maxB} min ≥ ${worstCase} min).`
                          : `Buffer is short by ${worstCase - maxB} min — raise "Max billable wait" to at least ${worstCase}.`}
                      </p>
                    </div>
                  );
                })()}
              </Section>

              <Section
                title="Custom duration"
                subtitle="Optional. Lets users book any duration beyond the slabs at a flat hourly rate."
              >
                <div className="p-3 bg-slate-50 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">Allow custom duration</span>
                    <Toggle
                      checked={form.customHours.enabled}
                      onChange={(v) => updateNested('customHours', { enabled: v })}
                    />
                  </div>
                  {form.customHours.enabled && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <Input
                        label="Customer label"
                        value={form.customHours.label}
                        onChange={(e) =>
                          updateNested('customHours', { label: e.target.value })
                        }
                      />
                      <Input
                        label="Max hours (0 = unlimited)"
                        type="number"
                        min={0}
                        value={form.customHours.maxHours}
                        onChange={(e) =>
                          updateNested('customHours', {
                            maxHours: Number(e.target.value),
                          })
                        }
                      />
                      <Input
                        label="Rate (₹ per hour)"
                        type="number"
                        min={0}
                        value={form.customHours.ratePerHour}
                        onChange={(e) =>
                          updateNested('customHours', {
                            ratePerHour: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                  )}
                </div>
              </Section>
            </>
          )}

          {/* {isHourly && (
            <Section
              title="Scheduled-ride dispatcher"
              subtitle="When does the system start hunting for a driver for a future-scheduled hourly ride? Morning rides booked the day before fire immediately so drivers can plan; everything earlier gets queued until closer to pickup."
            >
              <div className="p-3 bg-slate-50 rounded-xl space-y-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Morning ride window
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Rides whose pickup hour falls inside this window are
                    treated as &ldquo;morning&rdquo; rides. Tomorrow&rsquo;s
                    morning rides search immediately; later mornings are
                    held until the evening before pickup.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input
                    label="Morning start hour (0–23)"
                    type="number"
                    min={0}
                    max={23}
                    value={form.scheduledDispatch.MORNING_START_HOUR}
                    onChange={(e) =>
                      updateNested('scheduledDispatch', {
                        MORNING_START_HOUR: Number(e.target.value),
                      })
                    }
                  />
                  <Input
                    label="Morning end hour (1–24, exclusive)"
                    type="number"
                    min={1}
                    max={24}
                    value={form.scheduledDispatch.MORNING_END_HOUR}
                    onChange={(e) =>
                      updateNested('scheduledDispatch', {
                        MORNING_END_HOUR: Number(e.target.value),
                      })
                    }
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl space-y-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Lead-time for far-future morning rides
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    For a morning ride scheduled the day-after-tomorrow
                    or later, the assignment job fires at this hour the
                    evening BEFORE pickup (24-hour clock).
                  </p>
                </div>
                <Input
                  label="Evening trigger hour (0–23)"
                  type="number"
                  min={0}
                  max={23}
                  value={form.scheduledDispatch.LEAD_SCHEDULE_HOUR}
                  onChange={(e) =>
                    updateNested('scheduledDispatch', {
                      LEAD_SCHEDULE_HOUR: Number(e.target.value),
                    })
                  }
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl space-y-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Other scheduled-ride windows
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Short window = rides this close get the instant
                    flow. Long lead = how many hours before pickup we
                    fire the assignment job for non-morning rides.
                    Emergency pool = if no driver yet this many minutes
                    before pickup, the booking goes to admin manual
                    assignment.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Input
                    label="Short-window hours"
                    type="number"
                    min={0}
                    value={form.scheduledDispatch.SHORT_WINDOW_HOURS}
                    onChange={(e) =>
                      updateNested('scheduledDispatch', {
                        SHORT_WINDOW_HOURS: Number(e.target.value),
                      })
                    }
                  />
                  <Input
                    label="Long-lead hours"
                    type="number"
                    min={0}
                    value={form.scheduledDispatch.LONG_LEAD_HOURS}
                    onChange={(e) =>
                      updateNested('scheduledDispatch', {
                        LONG_LEAD_HOURS: Number(e.target.value),
                      })
                    }
                  />
                  <Input
                    label="Emergency-pool minutes"
                    type="number"
                    min={5}
                    value={form.scheduledDispatch.EMERGENCY_POOL_MINUTES}
                    onChange={(e) =>
                      updateNested('scheduledDispatch', {
                        EMERGENCY_POOL_MINUTES: Number(e.target.value),
                      })
                    }
                  />
                </div>
              </div>
            </Section>
          )} */}

          {isOutstation && (
            <OutstationFieldsEditor
              outstation={form.outstation}
              onChange={(outstation) => update({ outstation })}
            />
          )}

          {/* Shared extras */}
          <Section title="Shared extras" subtitle="Common to both service types.">
            <div className="p-3 bg-slate-50 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Night charge</span>
                <Toggle
                  checked={form.nightCharge.enabled}
                  onChange={(v) => updateNested('nightCharge', { enabled: v })}
                />
              </div>
              {form.nightCharge.enabled && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Input
                      label="Start (HH:mm)"
                      placeholder="22:00"
                      value={form.nightCharge.startTime}
                      onChange={(e) =>
                        updateNested('nightCharge', { startTime: e.target.value })
                      }
                    />
                    <Input
                      label="End (HH:mm)"
                      placeholder="06:00"
                      value={form.nightCharge.endTime}
                      onChange={(e) => updateNested('nightCharge', { endTime: e.target.value })}
                    />
                    <label className="flex flex-col gap-1.5">
                      <span className="text-sm font-medium text-text">Type</span>
                      <select
                        className="h-12 px-3 bg-white border border-border rounded-xl text-sm"
                        value={form.nightCharge.type}
                        onChange={(e) => updateNested('nightCharge', { type: e.target.value })}
                      >
                        <option value="flat">Flat ₹</option>
                        <option value="percentage">% of slab</option>
                      </select>
                    </label>
                    <Input
                      label={form.nightCharge.type === 'flat' ? 'Amount (₹)' : 'Amount (%)'}
                      type="number"
                      min={0}
                      value={form.nightCharge.amount}
                      onChange={(e) =>
                        updateNested('nightCharge', { amount: Number(e.target.value) })
                      }
                    />
                  </div>
                  {isHourly && (
                    <Input
                      label="Also apply if booking duration ≥ (hours, 0 = off)"
                      type="number"
                      min={0}
                      value={form.nightCharge.thresholdHours || 0}
                      onChange={(e) =>
                        updateNested('nightCharge', {
                          thresholdHours: Number(e.target.value),
                        })
                      }
                    />
                  )}
                </>
              )}
            </div>

            <div className="p-3 bg-slate-50 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold block">
                    {isOutstation
                      ? 'Food allowance (per day)'
                      : 'Driver food notice (long bookings)'}
                  </span>
                  <span className="text-xs text-slate-500">
                    {isOutstation
                      ? 'Added to the fare when the customer does not provide food.'
                      : 'Shows the customer a "please provide driver\u2019s food" notice once the booked duration crosses the threshold. No charge is added to the fare.'}
                  </span>
                </div>
                <Toggle
                  checked={form.foodAllowance.enabled}
                  onChange={(v) => updateNested('foodAllowance', { enabled: v })}
                />
              </div>
              {form.foodAllowance.enabled && (
                <>
                  {isOutstation ? (
                    <Input
                      label="Food allowance per day (\u20B9)"
                      type="number"
                      min={0}
                      value={form.foodAllowance.amount}
                      onChange={(e) =>
                        updateNested('foodAllowance', { amount: Number(e.target.value) })
                      }
                    />
                  ) : (
                    <Input
                      label="Show notice if booking duration ≥ (hours)"
                      type="number"
                      min={1}
                      value={form.foodAllowance.thresholdHours}
                      onChange={(e) =>
                        updateNested('foodAllowance', {
                          thresholdHours: Number(e.target.value),
                        })
                      }
                    />
                  )}
                </>
              )}
            </div>

            {/* {isHourly && (
              <div className="p-3 bg-slate-50 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-semibold block">
                      Stay allowance (long hourly bookings)
                    </span>
                    <span className="text-xs text-slate-500">
                      Added when the booked duration is long enough that the driver
                      may need to halt overnight.
                    </span>
                  </div>
                  <Toggle
                    checked={form.stayAllowance.enabled}
                    onChange={(v) => updateNested('stayAllowance', { enabled: v })}
                  />
                </div>
                {form.stayAllowance.enabled && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Input
                        label="Stay allowance amount (₹)"
                        type="number"
                        min={0}
                        value={form.stayAllowance.amount}
                        onChange={(e) =>
                          updateNested('stayAllowance', {
                            amount: Number(e.target.value),
                          })
                        }
                      />
                      <Input
                        label="Charge if booking ≥ (hours)"
                        type="number"
                        min={0}
                        value={form.stayAllowance.thresholdHours}
                        onChange={(e) =>
                          updateNested('stayAllowance', {
                            thresholdHours: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">
                        Let the customer opt out (they&apos;ll arrange driver&apos;s
                        accommodation)
                      </span>
                      <Toggle
                        checked={!!form.stayAllowance.userOptOut}
                        onChange={(v) =>
                          updateNested('stayAllowance', { userOptOut: v })
                        }
                      />
                    </div>
                  </>
                )}
              </div>
            )} */}
          </Section>

          {/* Platform charges */}
          <Section
            title="Platform charges"
            subtitle="Service charge and GST are added to the customer's total. Commission is deducted from the driver's earning."
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input
                label="Service charge (%)"
                type="number"
                min={0}
                max={100}
                value={form.serviceChargePercent}
                onChange={(e) => update({ serviceChargePercent: Number(e.target.value) })}
              />
              <Input
                label="GST (%)"
                type="number"
                min={0}
                max={100}
                value={form.gstPercent}
                onChange={(e) => update({ gstPercent: Number(e.target.value) })}
              />
              <Input
                label="Platform commission (%)"
                type="number"
                min={0}
                max={100}
                value={form.platformCommissionPercent}
                onChange={(e) =>
                  update({ platformCommissionPercent: Number(e.target.value) })
                }
              />
            </div>
          </Section>

          {/* Cancellation policy — pre-arrival fee is a flat ₹; post-arrival
              fee is admin-configurable (flat ₹ OR % of paid). The fee is
              then split between the assigned driver and the platform per
              `driverSharePercent`. */}
          <Section
            title="Cancellation policy"
            subtitle="Pre-arrival fee is a flat ₹. Post-arrival fee can be flat or a percentage of the paid amount. Driver penalty is a flat ₹ debit when the driver cancels."
          >
            <Input
              label="Flat fee after driver is assigned (₹)"
              type="number"
              min={0}
              value={form.cancellation.flatFeeAfterAssignment}
              onChange={(e) =>
                updateNested('cancellation', {
                  flatFeeAfterAssignment: Number(e.target.value),
                })
              }
            />

            <div className="p-3 bg-slate-50 rounded-xl space-y-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Fee after driver reaches pickup
                </p>
                <p className="text-xs text-slate-500">
                  Pick flat (₹) for predictable deductions, or percentage
                  (% of paid amount) so the fee scales with fare size.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-text">Type</span>
                  <select
                    className="h-12 px-3 bg-white border border-border rounded-xl text-sm"
                    value={form.cancellation.arrivedFeeType || 'flat'}
                    onChange={(e) =>
                      updateNested('cancellation', {
                        arrivedFeeType: e.target.value,
                      })
                    }
                  >
                    <option value="flat">Flat {'\u20B9'}</option>
                    <option value="percentage">% of paid amount</option>
                  </select>
                </label>
                <Input
                  label={
                    form.cancellation.arrivedFeeType === 'percentage'
                      ? 'Amount (%)'
                      : `Amount (\u20B9)`
                  }
                  type="number"
                  min={0}
                  max={
                    form.cancellation.arrivedFeeType === 'percentage'
                      ? 100
                      : undefined
                  }
                  value={form.cancellation.arrivedFeeAmount}
                  onChange={(e) =>
                    updateNested('cancellation', {
                      arrivedFeeAmount: Number(e.target.value),
                    })
                  }
                />
              </div>
              <p className="text-[11px] text-slate-500">
                <strong>Before driver is assigned:</strong> free.
                {' '}<strong>After assigned (en route):</strong>
                {' '}flat {'\u20B9'}{form.cancellation.flatFeeAfterAssignment || 0}.
                {' '}<strong>After driver reaches pickup:</strong>{' '}
                {form.cancellation.arrivedFeeType === 'percentage'
                  ? `${form.cancellation.arrivedFeeAmount || 0}% of paid amount`
                  : `flat \u20B9${form.cancellation.arrivedFeeAmount || 0}`}
                .
              </p>
            </div>

            {/* Cancellation revenue split — driver share vs company share. */}
            <CancellationRevenueSplit
              driverSharePercent={form.cancellation.driverSharePercent || 0}
              onChange={(v) =>
                updateNested('cancellation', { driverSharePercent: v })
              }
            />

            <div className="pt-2 border-t border-slate-200">
              <Input
                label="Driver cancel penalty (₹)"
                type="number"
                min={0}
                value={form.cancellation.driverCancellationPenalty}
                onChange={(e) =>
                  updateNested('cancellation', {
                    driverCancellationPenalty: Number(e.target.value),
                  })
                }
              />
            </div>

            {/* Driver-side grace + daily quota. Within the grace window
                AND while free chances remain → no rupee penalty. After
                either, the penalty above applies. Counter resets daily. */}
            <div className="pt-3 border-t border-slate-200 space-y-3">
              <div>
                <p className="text-xs font-semibold text-slate-700">
                  Driver cancellation grace
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Drivers can cancel inside this window without losing money,
                  up to the daily limit. Each cancel — penalty or not — burns
                  one chance.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input
                  label="Driver grace window (min)"
                  type="number"
                  min={0}
                  value={form.cancellation.driverGraceMinutes ?? 2}
                  onChange={(e) =>
                    updateNested('cancellation', {
                      driverGraceMinutes: Number(e.target.value),
                    })
                  }
                />
                <Input
                  label="Free driver cancels per day"
                  type="number"
                  min={0}
                  value={form.cancellation.driverDailyFreeCancellations ?? 3}
                  onChange={(e) =>
                    updateNested('cancellation', {
                      driverDailyFreeCancellations: Number(e.target.value),
                    })
                  }
                />
              </div>
              <p className="text-[11px] text-slate-500">
                Driver cancels within{' '}
                <strong>{form.cancellation.driverGraceMinutes ?? 2} min</strong>{' '}
                of accepting → warning + chance burned, no penalty (limit{' '}
                <strong>
                  {form.cancellation.driverDailyFreeCancellations ?? 3}/day
                </strong>
                ). After that → {'\u20B9'}
                {form.cancellation.driverCancellationPenalty || 0} deducted.
              </p>
            </div>
          </Section>
          {isHourly && (
            <Section
              title="Scheduled-ride dispatcher"
              subtitle="When does the system start hunting for a driver for a future-scheduled hourly ride? Morning rides booked the day before fire immediately so drivers can plan; everything earlier gets queued until closer to pickup."
            >
              <div className="p-3 bg-slate-50 rounded-xl space-y-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Morning ride window
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Rides whose pickup hour falls inside this window are
                    treated as &ldquo;morning&rdquo; rides. Tomorrow&rsquo;s
                    morning rides search immediately; later mornings are
                    held until the evening before pickup.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input
                    label="Morning start hour (0–23)"
                    type="number"
                    min={0}
                    max={23}
                    value={form.scheduledDispatch.MORNING_START_HOUR}
                    onChange={(e) =>
                      updateNested('scheduledDispatch', {
                        MORNING_START_HOUR: Number(e.target.value),
                      })
                    }
                  />
                  <Input
                    label="Morning end hour (1–24, exclusive)"
                    type="number"
                    min={1}
                    max={24}
                    value={form.scheduledDispatch.MORNING_END_HOUR}
                    onChange={(e) =>
                      updateNested('scheduledDispatch', {
                        MORNING_END_HOUR: Number(e.target.value),
                      })
                    }
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl space-y-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Lead-time for far-future morning rides
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    For a morning ride scheduled the day-after-tomorrow
                    or later, the assignment job fires at this hour the
                    evening BEFORE pickup (24-hour clock).
                  </p>
                </div>
                <Input
                  label="Evening trigger hour (0–23)"
                  type="number"
                  min={0}
                  max={23}
                  value={form.scheduledDispatch.LEAD_SCHEDULE_HOUR}
                  onChange={(e) =>
                    updateNested('scheduledDispatch', {
                      LEAD_SCHEDULE_HOUR: Number(e.target.value),
                    })
                  }
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl space-y-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Other scheduled-ride windows
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Short window = rides this close get the instant
                    flow. Long lead = how many hours before pickup we
                    fire the assignment job for non-morning rides.
                    Emergency pool = if no driver yet this many minutes
                    before pickup, the booking goes to admin manual
                    assignment.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Input
                    label="Short-window hours"
                    type="number"
                    min={0}
                    value={form.scheduledDispatch.SHORT_WINDOW_HOURS}
                    onChange={(e) =>
                      updateNested('scheduledDispatch', {
                        SHORT_WINDOW_HOURS: Number(e.target.value),
                      })
                    }
                  />
                  <Input
                    label="Long-lead hours"
                    type="number"
                    min={0}
                    value={form.scheduledDispatch.LONG_LEAD_HOURS}
                    onChange={(e) =>
                      updateNested('scheduledDispatch', {
                        LONG_LEAD_HOURS: Number(e.target.value),
                      })
                    }
                  />
                  <Input
                    label="Emergency-pool minutes"
                    type="number"
                    min={5}
                    value={form.scheduledDispatch.EMERGENCY_POOL_MINUTES}
                    onChange={(e) =>
                      updateNested('scheduledDispatch', {
                        EMERGENCY_POOL_MINUTES: Number(e.target.value),
                      })
                    }
                  />
                  <Input
                    label="Retry delay (minutes)"
                    type="number"
                    min={1}
                    value={form.scheduledDispatch.RETRY_DELAY_MINUTES}
                    onChange={(e) =>
                      updateNested('scheduledDispatch', {
                        RETRY_DELAY_MINUTES: Number(e.target.value),
                      })
                    }
                  />
                  <Input
                    label="Ride buffer (minutes)"
                    type="number"
                    min={0}
                    value={form.scheduledDispatch.RIDE_BUFFER_MINUTES}
                    onChange={(e) =>
                      updateNested('scheduledDispatch', {
                        RIDE_BUFFER_MINUTES: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  When a dispatch round finds no driver we wait this many
                  minutes and try again — looping until pickup is closer
                  than the emergency-pool window, at which point the
                  booking is parked for admin to assign manually. The
                  ride buffer is padded around every existing booking so
                  drivers with a future scheduled ride still receive new
                  offers, as long as the new ride finishes at least this
                  many minutes before the next pickup (and vice-versa).
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl space-y-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Booking floor &amp; reminders
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    The customer&rsquo;s scheduled-ride date picker is
                    capped to at least this many hours from now (the
                    backend also enforces it on create). Reminders are a
                    comma-separated list of minutes-before-pickup at
                    which the worker pushes an in-app toast to the
                    customer and the assigned driver. They are queued
                    only AFTER a driver has been assigned to the
                    booking.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input
                    label="Minimum lead time (hours)"
                    type="number"
                    min={0}
                    step="0.5"
                    value={form.scheduledDispatch.MIN_SCHEDULED_LEAD_HOURS}
                    onChange={(e) =>
                      updateNested('scheduledDispatch', {
                        MIN_SCHEDULED_LEAD_HOURS: Number(e.target.value),
                      })
                    }
                  />
                  <Input
                    label="Reminder offsets (minutes, comma-sep)"
                    type="text"
                    value={(
                      form.scheduledDispatch.REMINDER_OFFSETS_MINUTES || []
                    ).join(', ')}
                    onChange={(e) =>
                      updateNested('scheduledDispatch', {
                        REMINDER_OFFSETS_MINUTES: e.target.value
                          .split(',')
                          .map((s) => Number(s.trim()))
                          .filter((n) => Number.isFinite(n) && n > 0),
                      })
                    }
                  />
                </div>
              </div>
            </Section>
          )}
          <div className="flex gap-3 pt-2 sticky bottom-0 bg-white pb-1">
            <Button variant="outline" size="md" fullWidth type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="admin"
              size="md"
              fullWidth
              type="button"
              onClick={handleSave}
              loading={submitting}
              icon={Save}
            >
              Save pricing
            </Button>
          </div>
        </div>

        <FarePreview form={form} />
      </div>
    </Modal>
  );
};

/**
 * Cancellation-revenue split editor. Single slider/number → the driver
 * percentage; the company percentage is just `100 − driver`. We render
 * both pills so the admin can sanity-check the split at a glance.
 *
 * The actual rupee split happens server-side when a customer cancels —
 * see `splitCancellationFee` in `bookingCancellation.service.js`.
 */
function CancellationRevenueSplit({ driverSharePercent, onChange }) {
  const driver = Math.max(0, Math.min(100, Number(driverSharePercent) || 0));
  const company = Math.max(0, 100 - driver);
  return (
    <div className="p-3 bg-slate-50 rounded-xl space-y-3">
      <div>
        <p className="text-sm font-semibold text-slate-900">
          Cancellation revenue split
        </p>
        <p className="text-xs text-slate-500">
          How the cancellation fee is divided between the driver and the
          company. Driver share is credited to the driver&apos;s wallet on
          cancel; company share is booked on the revenue ledger.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-end">
        <Input
          label="Driver share (%)"
          type="number"
          min={0}
          max={100}
          value={driver}
          onChange={(e) => {
            const n = Math.max(0, Math.min(100, Number(e.target.value) || 0));
            onChange(n);
          }}
        />
        <div className="text-center text-xs text-slate-400 pb-3">+</div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-text">
            Company share (%)
          </span>
          <div className="h-12 px-3 bg-white border border-border rounded-xl text-sm flex items-center font-semibold text-slate-900">
            {company}%
            <span className="ml-auto text-[10px] uppercase tracking-wide text-slate-400 font-medium">
              auto
            </span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <SplitPreview label="Driver gets" pct={driver} tone="emerald" />
        <SplitPreview label="Company keeps" pct={company} tone="slate" />
      </div>
    </div>
  );
}

function SplitPreview({ label, pct, tone }) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
  };
  return (
    <div
      className={`rounded-xl border px-3 py-2 flex items-center justify-between ${
        tones[tone] || tones.slate
      }`}
    >
      <span className="font-semibold">{label}</span>
      <span className="font-bold">{pct}%</span>
    </div>
  );
}

export default ServicePricingModal;
