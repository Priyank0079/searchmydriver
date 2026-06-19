import { useEffect, useMemo, useState } from 'react';
import { Compass, Loader2, MapPin, Search, X } from 'lucide-react';
import BottomSheet from '../../../../components/BottomSheet';
import Button from '../../../../components/Button';
import api from '../../../../utils/api';

/**
 * Driver-side multi-select picker for the zones a driver is willing
 * to accept outstation pickups from. Used by `OutstationOptInCard`
 * on the driver home — when the driver tries to flip "Available for
 * outstation" on without any saved zones, this sheet pops up and
 * blocks confirmation until they pick at least one zone.
 *
 * Props:
 *   isOpen      — boolean
 *   onClose     — close handler (no-op save)
 *   onConfirm   — async (zoneIds: string[]) => void
 *                 Fired when the driver hits "Save". The card owns the
 *                 actual API call so it can keep the toggle + zones
 *                 update in a single optimistic flip.
 *   initial     — string[] of zone ids that are already selected
 *   submitting  — disable the confirm button while the parent's API
 *                 call is in flight
 */
const OutstationZonesSheet = ({
  isOpen,
  onClose,
  onConfirm,
  initial = [],
  submitting = false,
}) => {
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(() => new Set(initial.map(String)));

  useEffect(() => {
    if (!isOpen) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mirroring server-fetched value
    setSelected(new Set(initial.map(String)));
    setSearch('');
  }, [isOpen, initial]);

  useEffect(() => {
    if (!isOpen) return undefined;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get('/common/zones')
      .then((res) => {
        if (cancelled) return;
        const list = res?.data?.data || [];
        setZones(Array.isArray(list) ? list.filter((z) => z?.isActive !== false) : []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.response?.data?.message || 'Could not load zones');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return zones;
    return zones.filter((z) => {
      const name = (z?.name || '').toLowerCase();
      const city = (z?.city || '').toLowerCase();
      const code = (z?.code || '').toLowerCase();
      return name.includes(q) || city.includes(q) || code.includes(q);
    });
  }, [zones, search]);

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const key = String(id);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectedCount = selected.size;
  const canConfirm = selectedCount > 0 && !submitting;

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm?.(Array.from(selected));
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={submitting ? () => {} : onClose}
      showHandle={false}
      className="!max-w-xl"
    >
      <div className="-mt-2">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
            <Compass className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-text leading-tight">
              Pick your outstation zones
            </h3>
            <p className="text-[11px] text-text-muted mt-0.5 leading-snug">
              Admins will only offer you outstation trips that pick up
              from one of these zones. You can change this later from
              Home.
            </p>
          </div>
          <button
            type="button"
            onClick={submitting ? undefined : onClose}
            disabled={submitting}
            className="p-1.5 rounded-full hover:bg-gray-100 text-text-secondary disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by zone or city"
            className="w-full h-10 pl-9 pr-3 rounded-xl border border-border-light bg-white text-sm focus:outline-none focus:border-primary"
          />
        </div>

        <div className="max-h-[44vh] overflow-y-auto -mx-1 px-1 space-y-1.5">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
            </div>
          ) : error ? (
            <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-sm">
              {error}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6 rounded-xl bg-bg text-text-muted text-sm text-center">
              {search
                ? `No zones match "${search}"`
                : 'No active zones are available right now. Check back later.'}
            </div>
          ) : (
            filtered.map((z) => {
              const id = String(z._id);
              const isSelected = selected.has(id);
              return (
                <button
                  type="button"
                  key={id}
                  onClick={() => toggle(id)}
                  className={`w-full text-left flex items-center gap-3 p-3 rounded-2xl border transition ${
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-border-light bg-white hover:border-slate-300'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      isSelected
                        ? 'bg-primary/15 text-primary'
                        : 'bg-bg text-text-secondary'
                    }`}
                  >
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text truncate">
                      {z.name}
                    </p>
                    <p className="text-[11px] text-text-muted truncate">
                      {[z.city, z.code].filter(Boolean).join(' \u00b7 ') ||
                        'Active zone'}
                    </p>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                      isSelected
                        ? 'bg-primary border-primary'
                        : 'bg-white border-slate-300'
                    }`}
                  >
                    {isSelected && (
                      <svg
                        viewBox="0 0 16 16"
                        className="w-3.5 h-3.5 text-slate-900"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="3 8.5 6.5 12 13 5" />
                      </svg>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-border-light flex items-center gap-3">
          <span className="text-[11px] text-text-muted flex-1 truncate">
            {selectedCount > 0
              ? `${selectedCount} zone${selectedCount === 1 ? '' : 's'} selected`
              : 'Pick at least one zone to continue'}
          </span>
          <Button
            variant="outline"
            size="md"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            variant="driver"
            size="md"
            onClick={handleConfirm}
            disabled={!canConfirm}
            loading={submitting}
          >
            Save
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
};

export default OutstationZonesSheet;
