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
  waitingCharge: { freeWaitingMinutes: 15, chargePerMinute: 2 },
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
  nightCharge: { enabled: false, startTime: '22:00', endTime: '06:00', type: 'flat', amount: 0 },
  tollParkingEnabled: true,
  foodAllowance: {
    enabled: serviceType === SERVICE_TYPES.OUTSTATION,
    amount: 0,
    thresholdHours: 4,
  },

  // Platform
  serviceChargePercent: 0,
  gstPercent: 18,
  platformCommissionPercent: 20,

  // Policies
  cancellation: {
    userCancellationFeePercent: 10,
    driverCancellationPenalty: 50,
    freeCancellationMinutes: 2,
  },
  driverSearch: {
    searchTimeoutMinutes: 5,
    searchRadiusKm: 10,
    maxRetries: 3,
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
    customHours: { ...base.customHours, ...(existing.customHours || {}) },
    cancellation: { ...base.cancellation, ...(existing.cancellation || {}) },
    driverSearch: { ...base.driverSearch, ...(existing.driverSearch || {}) },
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
              )}
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
              <div>
                <span className="text-sm font-semibold block">Toll &amp; parking</span>
                <span className="text-xs text-slate-500">
                  Driver can add toll/parking charges during the trip
                </span>
              </div>
              <Toggle
                checked={form.tollParkingEnabled}
                onChange={(v) => update({ tollParkingEnabled: v })}
              />
            </div>

            <div className="p-3 bg-slate-50 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold block">
                    Food allowance{' '}
                    {isOutstation ? '(per day)' : '(once threshold is crossed)'}
                  </span>
                  <span className="text-xs text-slate-500">
                    {isOutstation
                      ? 'Added when the customer does not provide food'
                      : 'Added when the booked duration is long enough that the driver needs a meal'}
                  </span>
                </div>
                <Toggle
                  checked={form.foodAllowance.enabled}
                  onChange={(v) => updateNested('foodAllowance', { enabled: v })}
                />
              </div>
              {form.foodAllowance.enabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input
                    label={
                      isOutstation
                        ? 'Food allowance per day (₹)'
                        : 'Food allowance amount (₹)'
                    }
                    type="number"
                    min={0}
                    value={form.foodAllowance.amount}
                    onChange={(e) =>
                      updateNested('foodAllowance', { amount: Number(e.target.value) })
                    }
                  />
                  {isHourly && (
                    <Input
                      label="Charge if booking ≥ (hours)"
                      type="number"
                      min={0}
                      value={form.foodAllowance.thresholdHours}
                      onChange={(e) =>
                        updateNested('foodAllowance', {
                          thresholdHours: Number(e.target.value),
                        })
                      }
                    />
                  )}
                </div>
              )}
            </div>
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

          {/* Cancellation */}
          <Section
            title="Cancellation policy"
            subtitle="User cancellation deducts a % of the paid fare after the free window. Driver cancellation deducts a flat penalty from their wallet."
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input
                label="Free cancel window (min)"
                type="number"
                min={0}
                value={form.cancellation.freeCancellationMinutes}
                onChange={(e) =>
                  updateNested('cancellation', {
                    freeCancellationMinutes: Number(e.target.value),
                  })
                }
              />
              <Input
                label="User cancel fee (%)"
                type="number"
                min={0}
                max={100}
                value={form.cancellation.userCancellationFeePercent}
                onChange={(e) =>
                  updateNested('cancellation', {
                    userCancellationFeePercent: Number(e.target.value),
                  })
                }
              />
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
          </Section>

          {/* Driver search */}
          <Section
            title="Driver search"
            subtitle="Controls how the system searches for matched drivers when a booking is created."
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input
                label="Search timeout (min)"
                type="number"
                min={1}
                value={form.driverSearch.searchTimeoutMinutes}
                onChange={(e) =>
                  updateNested('driverSearch', {
                    searchTimeoutMinutes: Number(e.target.value),
                  })
                }
              />
              <Input
                label="Search radius (km)"
                type="number"
                min={1}
                value={form.driverSearch.searchRadiusKm}
                onChange={(e) =>
                  updateNested('driverSearch', { searchRadiusKm: Number(e.target.value) })
                }
              />
              <Input
                label="Max driver offers"
                type="number"
                min={1}
                value={form.driverSearch.maxRetries}
                onChange={(e) =>
                  updateNested('driverSearch', { maxRetries: Number(e.target.value) })
                }
              />
            </div>
          </Section>

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

export default ServicePricingModal;
