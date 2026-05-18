import { Check, X } from 'lucide-react';

const OPTIONS = [
  {
    value: true,
    label: 'Yes',
    Icon: Check,
    selected:
      'border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-600/20',
    idle: 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
  },
  {
    value: false,
    label: 'No',
    Icon: X,
    selected: 'border-slate-700 bg-slate-900 text-white ring-2 ring-slate-900/20',
    idle: 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
  },
];

/**
 * Binary yes/no control. value: true | false | null (unanswered).
 */
const YesNoChoice = ({ value = null, onChange, disabled = false, className = '' }) => (
  <div
    className={`grid grid-cols-2 gap-2 ${className}`}
    role="group"
    aria-label="Yes or no"
  >
    {OPTIONS.map(({ value: optionValue, label, Icon, selected, idle }) => {
      const isSelected = value === optionValue;
      return (
        <button
          key={label}
          type="button"
          disabled={disabled}
          aria-pressed={isSelected}
          onClick={() => onChange(optionValue)}
          className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-semibold transition-all disabled:opacity-50 disabled:pointer-events-none
            ${isSelected ? selected : idle}`}
        >
          <Icon className="w-4 h-4 shrink-0" strokeWidth={2.5} />
          {label}
        </button>
      );
    })}
  </div>
);

export default YesNoChoice;
