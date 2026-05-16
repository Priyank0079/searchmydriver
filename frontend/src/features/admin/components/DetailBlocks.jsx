export function SectionCard({ title, children }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-5">
      <h3 className="text-sm font-semibold text-slate-800 mb-4 tracking-wide">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

export function InfoItem({ label, value, capitalize = false }) {
  const displayValue = value && value !== 'N/A' ? value : '—';

  return (
    <div className="group">
      <p className="text-xs text-slate-400 mb-1.5 font-medium uppercase tracking-wider">{label}</p>
      <p className={`text-sm text-slate-700 ${capitalize ? 'capitalize' : ''} font-normal`}>
        {displayValue}
      </p>
    </div>
  );
}

export function InfoGrid({ items, columns = 2 }) {
  return (
    <div className={`grid grid-cols-1 ${columns === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-1'} gap-5`}>
      {items.map((item, idx) => (
        <InfoItem key={idx} {...item} />
      ))}
    </div>
  );
}
