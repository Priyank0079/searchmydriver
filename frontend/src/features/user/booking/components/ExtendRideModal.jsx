import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Clock, Minus, Plus, X } from 'lucide-react';
import Button from '../../../../components/Button';

/**
 * "Your time is almost up — extend the ride?" modal. Reuses the same
 * stepper-pattern as the slab-selection custom-hours UI, but stays tiny
 * because it only needs to gather a single integer.
 *
 *   props:
 *     - open         Whether the sheet is visible.
 *     - onClose      Called when the user dismisses.
 *     - onSubmit     async (additionalHours) => any
 *     - extraHourRate  Rupees per extra hour shown to the user.
 *     - remainingMinutes  How long is left of the original booking. We show
 *                         this so the user knows they're not paying for time
 *                         they haven't used.
 *     - minHours / maxHours
 */
const ExtendRideModal = ({
  open,
  onClose,
  onSubmit,
  extraHourRate = 0,
  remainingMinutes = 0,
  minHours = 1,
  maxHours = 8,
}) => {
  const [hours, setHours] = useState(minHours);
  const [busy, setBusy] = useState(false);

  // Reset the stepper every time the sheet reopens so a previous dismissal
  // doesn't leave a stale 5h selection.
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- canonical reset when sheet opens
    setHours(minHours);
    setBusy(false);
  }, [open, minHours]);

  const cost = useMemo(() => Math.max(0, hours) * extraHourRate, [hours, extraHourRate]);

  const handleConfirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onSubmit(hours);
      toast.success(`Ride extended by ${hours}h`);
      onClose?.();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Could not extend ride');
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[85] flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/45"
        onClick={busy ? undefined : onClose}
      />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 pb-6 animate-slide-up">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="w-10 h-10 rounded-2xl bg-primary/15 flex items-center justify-center mb-2">
              <Clock className="w-5 h-5 text-primary-dark" />
            </div>
            <h2 className="text-lg font-bold text-text">Extend your ride?</h2>
            <p className="text-xs text-text-muted mt-0.5">
              {remainingMinutes <= 0
                ? "Your booked time is over. Add more hours to keep the driver."
                : `About ${Math.max(1, remainingMinutes)} min left on your original booking. Add more if you need.`}
            </p>
          </div>
          {!busy && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-gray-100 -mt-1 -mr-1"
              aria-label="Close"
            >
              <X className="w-4 h-4 text-text-muted" />
            </button>
          )}
        </div>

        <div className="bg-bg rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-text-muted uppercase tracking-wide">
              Add hours
            </p>
            <p className="text-3xl font-bold text-text mt-1">
              {hours}
              <span className="text-base font-medium text-text-muted">{' '}h</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="w-10 h-10 rounded-full border border-border bg-white text-text disabled:opacity-50 flex items-center justify-center"
              disabled={busy || hours <= minHours}
              onClick={() => setHours((h) => Math.max(minHours, h - 1))}
              aria-label="Decrease"
            >
              <Minus className="w-4 h-4" />
            </button>
            <button
              type="button"
              className="w-10 h-10 rounded-full bg-primary text-white disabled:opacity-50 flex items-center justify-center"
              disabled={busy || hours >= maxHours}
              onClick={() => setHours((h) => Math.min(maxHours, h + 1))}
              aria-label="Increase"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-text-muted">Extra fare</span>
          <span className="text-base font-bold text-text">₹{cost}</span>
        </div>
        <p className="text-[11px] text-text-muted mt-1 leading-snug">
          Calculated at ₹{extraHourRate}/hr. The amount is added to whatever you pay at the end of the ride.
        </p>

        <Button
          fullWidth
          loading={busy}
          onClick={handleConfirm}
          className="mt-5"
        >
          Extend by {hours}h · ₹{cost}
        </Button>
        <Button fullWidth variant="ghost" disabled={busy} onClick={onClose} className="mt-2">
          Not now
        </Button>
      </div>
    </div>
  );
};

export default ExtendRideModal;
