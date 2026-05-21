import Input from '../../../../components/Input';

const OutstationFieldsEditor = ({ outstation, onChange }) => {
  const update = (patch) => onChange({ ...outstation, ...patch });
  const o = outstation || {};

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-sm font-bold text-slate-900">Outstation rates</h4>
        <p className="text-xs text-slate-500">
          Daily flat rate plus optional per-km charges and overnight allowances.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Input
          label="Daily rate (₹/day)"
          type="number"
          min={0}
          value={o.dailyRate ?? 0}
          onChange={(e) => update({ dailyRate: Number(e.target.value) })}
          helper="Flat charge per day of the trip."
        />
        <Input
          label="Km included per day"
          type="number"
          min={0}
          value={o.kmIncludedPerDay ?? 0}
          onChange={(e) => update({ kmIncludedPerDay: Number(e.target.value) })}
          helper="0 = unlimited (no per-km charge)."
        />
        <Input
          label="Extra km rate (₹/km)"
          type="number"
          min={0}
          value={o.extraKmRate ?? 0}
          onChange={(e) => update({ extraKmRate: Number(e.target.value) })}
          helper={
            o.kmIncludedPerDay > 0
              ? 'Charged when actual km exceeds the daily limit.'
              : 'Ignored when km is unlimited.'
          }
        />
        <Input
          label="Night halt charge (₹/night)"
          type="number"
          min={0}
          value={o.nightHaltCharge ?? 0}
          onChange={(e) => update({ nightHaltCharge: Number(e.target.value) })}
          helper="Driver bata per night. Nights = days − 1."
        />
        <Input
          label="Stay charge per night (₹)"
          type="number"
          min={0}
          value={o.stayChargePerNight ?? 0}
          onChange={(e) => update({ stayChargePerNight: Number(e.target.value) })}
          helper="Added when customer doesn't provide accommodation."
        />
        <div className="grid grid-cols-2 gap-3">
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
