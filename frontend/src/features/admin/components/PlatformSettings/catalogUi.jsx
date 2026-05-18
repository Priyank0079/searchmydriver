import { Search, Loader2, Inbox } from 'lucide-react';
import Button from '../../../../components/Button';

export function CatalogPanel({ children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {children}
    </div>
  );
}

export function CatalogSubNav({ tabs, activeId, onChange, counts = {} }) {
  return (
    <div className="border-b border-slate-100 bg-slate-50/80 px-2 sm:px-4">
      <div className="flex overflow-x-auto no-scrollbar gap-1">
        {tabs.map((tab) => {
          const active = activeId === tab.id;
          const count = counts[tab.id];
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`
                relative flex items-center gap-2 px-4 py-3.5 text-sm font-semibold whitespace-nowrap transition-colors
                ${active ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'}
              `}
            >
              <tab.icon className={`w-4 h-4 ${active ? 'text-slate-800' : 'text-slate-400'}`} />
              {tab.label}
              {count != null && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                    active ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {count}
                </span>
              )}
              {active && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-slate-900 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function CatalogSectionHeader({ title, description, action }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 px-5 sm:px-6 pt-6 pb-4">
      <div className="min-w-0">
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        {description && (
          <p className="text-sm text-slate-500 mt-1 max-w-xl leading-relaxed">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CatalogToolbar({ search, onSearchChange, searchPlaceholder = 'Search...', children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 sm:px-6 pb-4">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full h-10 pl-10 pr-4 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-900/5"
        />
      </div>
      {children}
    </div>
  );
}

export function CatalogStatusBadge({ active }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
        active
          ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
          : 'bg-slate-100 text-slate-500 ring-1 ring-slate-200'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
      {active ? 'Active' : 'Hidden'}
    </span>
  );
}

export function CatalogTable({ columns, children, empty }) {
  if (empty) return null;
  return (
    <div className="overflow-x-auto border-t border-slate-100">
      <table className="w-full min-w-[520px]">
        <thead>
          <tr className="bg-slate-50/90">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-5 sm:px-6 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider ${col.className || ''}`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}

export function CatalogRow({ children, muted }) {
  return (
    <tr className={`transition-colors ${muted ? 'opacity-60' : 'hover:bg-slate-50/80'}`}>
      {children}
    </tr>
  );
}

export function CatalogCell({ children, className = '' }) {
  return (
    <td className={`px-5 sm:px-6 py-3.5 text-sm text-slate-700 align-middle ${className}`}>
      {children}
    </td>
  );
}

export function CatalogRowActions({ onEdit, onDelete }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <button
        type="button"
        onClick={onEdit}
        className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        aria-label="Edit"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
        aria-label="Delete"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  );
}

export function CatalogLoading() {
  return (
    <div className="py-16 flex flex-col items-center justify-center gap-3 border-t border-slate-100">
      <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
      <p className="text-sm text-slate-500">Loading catalog...</p>
    </div>
  );
}

export function CatalogEmpty({ title, description, actionLabel, onAction }) {
  return (
    <div className="py-16 px-6 flex flex-col items-center text-center border-t border-slate-100">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
        <Inbox className="w-7 h-7 text-slate-400" />
      </div>
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      {description && <p className="text-sm text-slate-500 mt-1 max-w-sm">{description}</p>}
      {onAction && (
        <Button variant="admin" size="md" onClick={onAction} className="mt-5">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

export function CatalogAddButton({ label, onClick }) {
  return (
    <Button variant="admin" size="md" onClick={onClick} className="inline-flex items-center gap-2">
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
      {label}
    </Button>
  );
}
