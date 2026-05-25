import { MapPinOff } from 'lucide-react';
import Modal from '../Modal';
import Button from '../Button';

/**
 * Rapido-style "we don't operate here yet" modal.
 *
 * Reusable across every surface that needs to block an action because the
 * user picked a location outside our service area:
 *   - Hourly booking trip-details page
 *   - Standard pickup-selection page
 *   - Future "schedule a ride" flows
 *
 * Pure presentation: the parent owns `open`, `onClose`, and any
 * "change location" handler. We accept an optional `zone` prop only so
 * we can hint at the nearest serviced area in the future — it's currently
 * informational.
 *
 *   props:
 *     - open               controlled visibility
 *     - onClose            close handler (also wired to the primary CTA)
 *     - onChangeLocation   optional — when provided, primary CTA closes the
 *                          dialog and calls this so the parent can open
 *                          their location picker.
 *     - locationLabel      what the user picked (shown in the body)
 *     - cityHint           optional city name, e.g. "Indore" → "We're not
 *                          live in Indore yet."
 */
const OutOfServiceDialog = ({
  open,
  onClose,
  onChangeLocation,
  locationLabel,
  cityHint,
}) => {
  const headline = cityHint
    ? `We're not live in ${cityHint} yet`
    : "We're not operating in this area yet";

  return (
    <Modal isOpen={open} onClose={onClose} size="sm" showClose>
      <div className="px-5 pt-2 pb-5 text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center mb-4">
          <MapPinOff className="w-7 h-7 text-rose-500" />
        </div>
        <h3 className="text-lg font-bold text-text leading-snug">{headline}</h3>
        <p className="mt-2 text-sm text-text-secondary leading-relaxed">
          We&apos;ll let you know the moment we expand here. For now please pick a
          location inside one of our serviced areas to continue.
        </p>

        {locationLabel && (
          <p className="mt-3 inline-flex max-w-full text-[11px] font-medium text-rose-700 bg-rose-50 rounded-full px-3 py-1 truncate">
            <span className="truncate">{locationLabel}</span>
          </p>
        )}

        <div className="mt-5 flex flex-col gap-2">
          {onChangeLocation && (
            <Button
              fullWidth
              onClick={() => {
                onClose?.();
                onChangeLocation();
              }}
            >
              Change pickup location
            </Button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-semibold text-text-muted hover:text-text py-2"
          >
            Got it
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default OutOfServiceDialog;
