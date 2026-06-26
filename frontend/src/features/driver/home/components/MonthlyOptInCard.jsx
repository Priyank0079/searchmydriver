import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Calendar } from 'lucide-react';
import Card from '../../../../components/Card';
import Toggle from '../../../../components/Toggle';
import api from '../../../../utils/api';
import { useDriverProfileStore } from '../../../../store/driver/useDriverProfileStore';
import { buildCacheKey } from '../../../../store/lib/buildCacheKey';

const MonthlyOptInCard = ({ initial }) => {
  const refetchProfile = useDriverProfileStore((s) => s.fetch);
  const profileKey = buildCacheKey('driver-profile', {});

  const [available, setAvailable] = useState(!!initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setAvailable(!!initial);
  }, [initial]);

  const handleToggle = async (next) => {
    if (saving) return;
    setSaving(true);
    const prev = available;
    setAvailable(next);
    try {
      await api.put('/driver/preferences/monthly-availability', { available: next });
      refetchProfile?.(profileKey, {}, { force: true });
      toast.success(
        next
          ? "You're now visible for monthly trips"
          : "You've opted out of monthly trips"
      );
    } catch (err) {
      setAvailable(prev);
      toast.error(
        err?.response?.data?.message || "Couldn't update your monthly preference"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card padding="p-4" className="flex items-center gap-4">
      <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
        <Calendar className="w-6 h-6 text-blue-700" />
      </div>
      <div className="flex-1 min-w-0">
        <h2 className="text-sm font-bold text-text truncate">
          Monthly Rides
        </h2>
        <p className="text-[11px] text-text-muted line-clamp-2 mt-0.5">
          {available
            ? 'You are available for monthly bookings.'
            : 'Turn on to receive monthly ride requests.'}
        </p>
      </div>
      <div className="shrink-0 flex items-center justify-center pt-1">
        <Toggle
          checked={available}
          onChange={handleToggle}
          disabled={saving}
          size="lg"
        />
      </div>
    </Card>
  );
};

export default MonthlyOptInCard;
