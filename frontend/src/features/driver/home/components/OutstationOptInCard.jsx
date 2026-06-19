import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { ChevronRight, Compass, MapPin, Pencil } from 'lucide-react';
import Card from '../../../../components/Card';
import Toggle from '../../../../components/Toggle';
import api from '../../../../utils/api';
import OutstationZonesSheet from './OutstationZonesSheet';
import { useDriverProfileStore } from '../../../../store/driver/useDriverProfileStore';
import { buildCacheKey } from '../../../../store/lib/buildCacheKey';

/**
 * Driver-side opt-in tile rendered on the home screen. Two responsibilities:
 *
 * 1. Toggle availability for outstation (multi-day round trips). Backend
 *    requires at least one preferred zone whenever availability is on,
 *    so flipping the toggle ON without saved zones opens the picker
 *    sheet and defers the actual API call until the driver confirms.
 * 2. Show + edit the saved zones at a glance (chips + "Edit"). Helps
 *    drivers quickly verify they're listed for the right cities before
 *    expecting offers.
 *
 * Why the toggle lives on home (and not Account):
 *   This is something a driver flips on / off frequently —
 *   "I'm free this weekend, take me off outstation" — so it
 *   needs to be one tap from the home screen, not buried under
 *   Account.
 */
const OutstationOptInCard = ({ initial, initialZones = [] }) => {
  const refetchProfile = useDriverProfileStore((s) => s.fetch);
  const profileKey = buildCacheKey('driver-profile', {});

  const initialZoneIds = useMemo(
    () =>
      (Array.isArray(initialZones) ? initialZones : [])
        .map((z) => String(z?._id || z))
        .filter(Boolean),
    [initialZones],
  );

  const [available, setAvailable] = useState(!!initial);
  const [zones, setZones] = useState(
    Array.isArray(initialZones) ? initialZones : [],
  );
  const [saving, setSaving] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Mirror server-fetched values when the profile re-fetches.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mirroring server-fetched value
    setAvailable(!!initial);
  }, [initial]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mirroring server-fetched value
    setZones(Array.isArray(initialZones) ? initialZones : []);
  }, [initialZones]);

  const persist = async ({ nextAvailable, zoneIds }) => {
    setSaving(true);
    try {
      const payload = { available: nextAvailable };
      if (Array.isArray(zoneIds)) payload.zoneIds = zoneIds;
      const res = await api.put(
        '/driver/preferences/outstation-availability',
        payload,
      );
      const updated = res?.data?.data || null;
      setAvailable(!!updated?.availableForOutstation);
      setZones(
        Array.isArray(updated?.preferredOutstationZones)
          ? updated.preferredOutstationZones
          : [],
      );
      refetchProfile?.(profileKey, {}, { force: true });
      toast.success(
        nextAvailable
          ? "You're now visible for outstation trips"
          : "You've opted out of outstation trips",
      );
      return true;
    } catch (err) {
      toast.error(
        err?.response?.data?.message ||
          "Couldn't update your outstation preference",
      );
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (next) => {
    if (saving) return;
    if (!next) {
      // Optimistic flip-off; rollback on failure.
      setAvailable(false);
      const ok = await persist({ nextAvailable: false });
      if (!ok) setAvailable(true);
      return;
    }
    // Turning ON. Force the picker if no saved zones — the
    // server will 400 anyway, so we collect zones up-front.
    if (!initialZoneIds.length) {
      setSheetOpen(true);
      return;
    }
    setAvailable(true);
    const ok = await persist({ nextAvailable: true });
    if (!ok) setAvailable(false);
  };

  const handleSheetConfirm = async (zoneIds) => {
    const ok = await persist({
      nextAvailable: true,
      zoneIds,
    });
    if (ok) setSheetOpen(false);
  };

  const handleEditZones = () => {
    if (saving) return;
    setSheetOpen(true);
  };

  const zoneChips = useMemo(
    () =>
      zones
        .map((z) => ({
          id: String(z?._id || z),
          name: z?.name || 'Zone',
          city: z?.city || '',
        }))
        .filter((z) => z.id && z.id !== 'undefined'),
    [zones],
  );

  const showZonesEmptyNudge = available && zoneChips.length === 0;

  return (
    <>
      <Card className="animate-fade-in-up">
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              available ? 'bg-primary/15' : 'bg-bg'
            }`}
          >
            <Compass
              className={`w-5 h-5 ${
                available ? 'text-primary' : 'text-text-secondary'
              }`}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text">
                  Available for outstation
                </p>
                <p className="text-[11px] text-text-muted mt-0.5 leading-snug">
                  Multi-day round trips assigned by the admin. Switch
                  off anytime.
                </p>
              </div>
              <Toggle
                checked={available}
                onChange={handleToggle}
                disabled={saving}
              />
            </div>

            {available && zoneChips.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border-light">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] uppercase tracking-wide text-text-muted font-semibold">
                    Pickup zones
                  </p>
                  <button
                    type="button"
                    onClick={handleEditZones}
                    disabled={saving}
                    className="text-[11px] font-semibold text-primary inline-flex items-center gap-0.5 disabled:opacity-50"
                  >
                    <Pencil className="w-3 h-3" />
                    Edit
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {zoneChips.map((z) => (
                    <span
                      key={z.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-[11px] font-semibold text-slate-700"
                    >
                      <MapPin className="w-3 h-3 text-primary" />
                      {z.name}
                      {z.city && (
                        <span className="text-text-muted font-normal">
                          {`\u00b7 ${z.city}`}
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {showZonesEmptyNudge && (
              <button
                type="button"
                onClick={handleEditZones}
                disabled={saving}
                className="mt-3 w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[12px] font-semibold hover:bg-amber-100 disabled:opacity-50"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span className="flex-1 text-left">
                  Pick the zones you want outstation pickups from
                </span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </Card>

      <OutstationZonesSheet
        isOpen={sheetOpen}
        onClose={() => {
          if (saving) return;
          setSheetOpen(false);
        }}
        onConfirm={handleSheetConfirm}
        initial={zoneChips.map((z) => z.id)}
        submitting={saving}
      />
    </>
  );
};

export default OutstationOptInCard;
