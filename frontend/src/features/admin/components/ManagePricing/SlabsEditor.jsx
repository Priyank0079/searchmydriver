import { Plus, Trash2 } from 'lucide-react';
import Input from '../../../../components/Input';
import Button from '../../../../components/Button';

const emptySlab = () => ({
  label: '',
  minHours: 0,
  maxHours: 1,
  price: 0,
  sortOrder: 0,
});

const SlabsEditor = ({ slabs = [], onChange }) => {
  const updateSlab = (idx, patch) => {
    const next = slabs.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    onChange(next);
  };

  const addSlab = () => {
    const last = slabs[slabs.length - 1];
    const min = last ? Number(last.maxHours) || 0 : 0;
    onChange([
      ...slabs,
      {
        ...emptySlab(),
        minHours: min,
        maxHours: min + 1,
        sortOrder: slabs.length,
      },
    ]);
  };

  const removeSlab = (idx) => {
    onChange(slabs.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold text-slate-900">Time slabs</h4>
          <p className="text-xs text-slate-500">
            Each slab is a fixed price for a duration window. Extra hours are billed via
            “extra hour charge”.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={addSlab}
          className="flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" /> Add slab
        </Button>
      </div>

      {slabs.length === 0 && (
        <p className="text-sm text-slate-500 p-4 text-center bg-slate-50 rounded-xl border border-dashed">
          No slabs yet. Click “Add slab” to define a duration → price block.
        </p>
      )}

      <div className="space-y-2">
        {slabs.map((slab, idx) => (
          <div
            key={idx}
            className="grid grid-cols-1 sm:grid-cols-[1.4fr_0.7fr_0.7fr_0.8fr_auto] gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 items-end"
          >
            <Input
              label="Label"
              placeholder="Up to 1 Hour"
              value={slab.label}
              onChange={(e) => updateSlab(idx, { label: e.target.value })}
            />
            <Input
              label="Min hours"
              type="number"
              min={0}
              step="0.5"
              value={slab.minHours}
              onChange={(e) => updateSlab(idx, { minHours: Number(e.target.value) })}
            />
            <Input
              label="Max hours"
              type="number"
              min={0}
              step="0.5"
              value={slab.maxHours}
              onChange={(e) => updateSlab(idx, { maxHours: Number(e.target.value) })}
            />
            <Input
              label="Price (₹)"
              type="number"
              min={0}
              value={slab.price}
              onChange={(e) => updateSlab(idx, { price: Number(e.target.value) })}
            />
            <button
              type="button"
              onClick={() => removeSlab(idx)}
              className="self-end mb-1 p-2.5 hover:bg-rose-50 rounded-xl text-slate-400 hover:text-rose-600 transition-colors"
              title="Remove slab"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SlabsEditor;
