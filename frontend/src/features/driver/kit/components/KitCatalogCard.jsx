import { Package, Check, ChevronRight } from 'lucide-react';

const KitCatalogCard = ({ kit, selected, onSelect }) => {
  const itemCount = kit.items?.length || 0;

  return (
    <button
      type="button"
      onClick={() => onSelect(kit)}
      className={`w-full text-left rounded-2xl border-2 p-4 transition-all ${
        selected
          ? 'border-slate-900 bg-slate-50 shadow-md ring-2 ring-primary/40'
          : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
              selected ? 'bg-slate-900 text-primary' : 'bg-slate-100 text-slate-500'
            }`}
          >
            <Package className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-text text-sm">{kit.name}</h3>
              {kit.isMandatory && (
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                  Recommended
                </span>
              )}
            </div>
            {kit.description && (
              <p className="text-xs text-text-muted mt-1 line-clamp-2">{kit.description}</p>
            )}
            <p className="text-lg font-bold text-slate-900 mt-2">₹{kit.price?.toLocaleString('en-IN')}</p>
            <p className="text-xs text-text-muted mt-1">{itemCount} item{itemCount === 1 ? '' : 's'} included</p>
          </div>
        </div>
        {selected ? (
          <span className="w-7 h-7 rounded-full bg-slate-900 flex items-center justify-center shrink-0">
            <Check className="w-4 h-4 text-primary" />
          </span>
        ) : (
          <ChevronRight className="w-5 h-5 text-slate-300 shrink-0 mt-1" />
        )}
      </div>

      {kit.items?.length > 0 && (
        <ul className="mt-3 pt-3 border-t border-slate-100 space-y-2">
          {kit.items.slice(0, 4).map((item, idx) => (
            <li key={item._id || idx} className="flex items-center gap-2 text-xs text-text-secondary">
              {item.image ? (
                <img src={item.image} alt="" className="w-8 h-8 rounded-lg object-cover border" />
              ) : (
                <span className="w-8 h-8 rounded-lg bg-slate-100" />
              )}
              <span className="flex-1 truncate">{item.name}</span>
              {item.hasVariants && (
                <span className="text-[10px] text-slate-400 shrink-0">{item.variantLabel || 'Options'}</span>
              )}
            </li>
          ))}
          {kit.items.length > 4 && (
            <li className="text-[10px] text-slate-400 pl-10">+{kit.items.length - 4} more</li>
          )}
        </ul>
      )}
    </button>
  );
};

export default KitCatalogCard;
