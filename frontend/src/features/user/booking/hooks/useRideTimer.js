import { useEffect, useMemo, useState } from 'react';
import { BOOKING_STATUS, PAYMENT_POLICY } from '../../../../constants/bookingStatus';

/**
 * Drives the in-ride countdown for the user side. Given the active booking,
 * it returns:
 *
 *   - `startedAt`          when the ride actually started (timeline)
 *   - `scheduledEndAt`     startedAt + (booked + extensions) hours
 *   - `remainingSeconds`   negative once we've crossed `scheduledEndAt`
 *   - `elapsedSeconds`     seconds since startedAt
 *   - `isStarted`          true while the booking status === STARTED
 *   - `shouldPromptExtension`  fires when remaining drops below the
 *                              configured lead time AND the booking hasn't
 *                              been extended in the last 5 minutes.
 *
 * The hook is pure timer + derived state — surfacing the prompt is left
 * to the page so the same data can drive other UI (progress bars, badges).
 */
export function useRideTimer(booking) {
  const [now, setNow] = useState(() => Date.now());

  const status = booking?.status;
  const startedAt = booking?.timeline?.startedAt
    ? new Date(booking.timeline.startedAt).getTime()
    : null;

  const totalHours = useMemo(() => {
    const base = booking?.hourly?.durationHours || 0;
    const extra =
      (booking?.extensions || []).reduce((sum, ext) => sum + (ext?.additionalHours || 0), 0);
    return base + extra;
  }, [booking?.hourly?.durationHours, booking?.extensions]);

  const scheduledEndAt = useMemo(() => {
    if (!startedAt || !totalHours) return null;
    return startedAt + totalHours * 3600 * 1000;
  }, [startedAt, totalHours]);

  // Tick at 1Hz once the ride is started — quiet otherwise so we don't burn
  // battery on listing/idle screens.
  useEffect(() => {
    if (status !== BOOKING_STATUS.STARTED) return undefined;
    const handle = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(handle);
  }, [status]);

  const remainingSeconds = useMemo(() => {
    if (!scheduledEndAt) return null;
    return Math.floor((scheduledEndAt - now) / 1000);
  }, [scheduledEndAt, now]);

  const elapsedSeconds = useMemo(() => {
    if (!startedAt) return null;
    return Math.floor((now - startedAt) / 1000);
  }, [startedAt, now]);

  // Trigger the extension prompt once the remaining time drops below the
  // configured lead time. Once we've crossed `scheduledEndAt` we keep
  // returning true so the prompt re-opens after a dismiss without the user
  // having to refresh.
  const shouldPromptExtension =
    status === BOOKING_STATUS.STARTED &&
    remainingSeconds != null &&
    remainingSeconds <= PAYMENT_POLICY.EXTENSION_PROMPT_LEAD_SECONDS;

  return {
    startedAt,
    scheduledEndAt,
    elapsedSeconds,
    remainingSeconds,
    isStarted: status === BOOKING_STATUS.STARTED,
    totalHours,
    shouldPromptExtension,
  };
}
