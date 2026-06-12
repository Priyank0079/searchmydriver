import Input from '../../../../components/Input';

/**
 * Outstation pricing has been simplified to two knobs:
 *
 *   - Daily rate (₹/day)        — flat base fare for every calendar day
 *                                 of the round trip.
 *   - Allowance per night (₹)   — single combined driver allowance
 *                                 (food + accommodation + driver bata
 *                                 rolled into one). Charged for every
 *                                 night (= days − 1) UNLESS the customer
 *                                 commits to arranging both the food
 *                                 AND stay themselves.
 *
 * Toll & parking are NOT billed by the platform — the customer settles
 * those directly with the driver. The booking flow surfaces a notice
 * for transparency; no rupee is added to the fare for them.
 */
const OutstationFieldsEditor = ({ outstation, onChange }) => {
  const update = (patch) => onChange({ ...outstation, ...patch });
  const o = outstation || {};

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-sm font-bold text-slate-900">
          Outstation rates
          <span className="text-[10px] uppercase tracking-wide text-primary font-semibold ml-1">
            Round trip
          </span>
        </h4>
        <p className="text-xs text-slate-500">
          Fare = daily rate × days + allowance × nights (allowance is
          waived when the customer arranges the driver&rsquo;s food and
          stay themselves). Service charge and GST are added on top.
          Toll &amp; parking are paid directly by the customer to the
          driver and are not added to the fare.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Input
          label="Daily rate (₹/day)"
          type="number"
          min={0}
          value={o.dailyRate ?? 0}
          onChange={(e) => update({ dailyRate: Number(e.target.value) })}
          helper="Flat ₹ billed for every calendar day of the round trip."
        />
        <Input
          label="Allowance per night (₹)"
          type="number"
          min={0}
          value={o.allowancePerNight ?? 0}
          onChange={(e) => update({ allowancePerNight: Number(e.target.value) })}
          helper="Driver&rsquo;s combined food + stay + bata. Charged per night, waived when the customer arranges everything."
        />
        <div className="grid grid-cols-2 gap-3 md:col-span-2">
          <Input
            label="Min days"
            type="number"
            min={1}
            value={o.minDays ?? 1}
            onChange={(e) => update({ minDays: Number(e.target.value) })}
          />
          <Input
            label="Max days (0 = unlimited)"
            type="number"
            min={0}
            value={o.maxDays ?? 0}
            onChange={(e) => update({ maxDays: Number(e.target.value) })}
          />
        </div>
      </div>
    </div>
  );
};

export default OutstationFieldsEditor;
