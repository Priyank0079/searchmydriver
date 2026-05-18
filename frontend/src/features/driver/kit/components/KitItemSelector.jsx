import Select from '../../../../components/Select';
import { getKitItemKey } from '../../../../utils/kitItems';

const KitItemSelector = ({ kitItems, selections, onChange, disabled }) => {
  if (!kitItems?.length) return null;

  const setVariant = (itemKey, itemId, variantId) => {
    onChange({
      ...selections,
      [itemKey]: { itemId, variantId },
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold text-text-muted uppercase">Select your preferences</p>
      {kitItems.map((item, index) => {
        const itemKey = getKitItemKey(item, index);
        const itemId = item._id || itemKey;
        const selected = selections[itemKey]?.variantId || '';

        return (
          <div
            key={itemKey}
            className="flex gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/80"
          >
            <div className="w-14 h-14 rounded-lg bg-white border overflow-hidden shrink-0">
              {item.image ? (
                <img src={item.image} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-400">
                  No img
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-text">{item.name}</p>
              {item.description && (
                <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{item.description}</p>
              )}
              {item.hasVariants ? (
                <div className="mt-2">
                  <Select
                    label={item.variantLabel || 'Size'}
                    value={selected}
                    onChange={(val) => setVariant(itemKey, itemId, val)}
                    placeholder={`Choose ${item.variantLabel || 'size'}`}
                    options={(item.variants || []).map((v) => ({
                      value: v.id,
                      label: v.label,
                    }))}
                    disabled={disabled}
                  />
                </div>
              ) : (
                <p className="text-xs text-text-muted mt-1">Included in kit</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default KitItemSelector;

export function buildItemSelectionsPayload(kitItems, selections) {
  return kitItems.map((item, index) => {
    const itemKey = getKitItemKey(item, index);
    const itemId = item._id || itemKey;
    const pick = selections[itemKey];
    if (item.hasVariants) {
      return { itemId, variantId: pick?.variantId };
    }
    return { itemId };
  });
}

export function validateSelections(kitItems, selections) {
  for (let i = 0; i < kitItems.length; i += 1) {
    const item = kitItems[i];
    const itemKey = getKitItemKey(item, i);
    if (item.hasVariants && !selections[itemKey]?.variantId) {
      return `Please select ${item.variantLabel || 'size'} for ${item.name}`;
    }
  }
  return null;
}
