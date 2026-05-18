const KitOrderItemsList = ({ selections, title = 'Kit items' }) => {
  const list = selections?.length ? selections : [];

  if (!list.length) {
    return <p className="text-sm text-slate-500">No item details recorded</p>;
  }

  return (
    <div className="space-y-3">
      {title && <p className="text-xs font-semibold uppercase text-slate-400">{title}</p>}
      {list.map((item) => (
        <div key={item.itemId} className="flex gap-3 items-start">
          <div className="w-12 h-12 rounded-lg bg-slate-100 border overflow-hidden shrink-0">
            {item.image ? (
              <img src={item.image} alt="" className="w-full h-full object-cover" />
            ) : null}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-800">{item.name}</p>
            {item.selectedVariant?.label && (
              <p className="text-xs text-slate-500 mt-0.5">
                {item.variantLabel}: <span className="font-semibold">{item.selectedVariant.label}</span>
              </p>
            )}
            {!item.hasVariants && (
              <p className="text-xs text-slate-400 mt-0.5">Qty: {item.qty || 1}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default KitOrderItemsList;
