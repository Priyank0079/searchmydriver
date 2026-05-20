import { Circle, Pentagon } from 'lucide-react';
import { ZONE_SHAPE, ZONE_SHAPE_OPTIONS } from '../../constants/zoneShapes';

const ICONS = {
  [ZONE_SHAPE.CIRCLE]: Circle,
  [ZONE_SHAPE.POLYGON]: Pentagon,
};

const ZoneShapeTypePicker = ({ value, onChange, disabled }) => (
  <div className="grid grid-cols-2 gap-2">
    {ZONE_SHAPE_OPTIONS.map((opt) => {
      const Icon = ICONS[opt.value];
      const selected = value === opt.value;
      return (
        <button
          key={opt.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(opt.value)}
          className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
            selected
              ? 'border-primary bg-primary-50 ring-2 ring-primary/30'
              : 'border-slate-200 bg-white hover:border-slate-300'
          } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
        >
          <Icon
            className={`w-5 h-5 mt-0.5 shrink-0 ${selected ? 'text-slate-900' : 'text-slate-400'}`}
          />
          <span>
            <span className="block text-sm font-semibold text-slate-900">{opt.label}</span>
            <span className="block text-xs text-slate-500 mt-0.5">{opt.description}</span>
          </span>
        </button>
      );
    })}
  </div>
);

export default ZoneShapeTypePicker;
