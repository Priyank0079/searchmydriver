/**
 * Shared outstation duration math used by the variant + duration pages
 * and the review/confirm displays. Keep this in lockstep with the
 * backend's `computeOutstationDuration` in `booking.service.js` —
 * server is the source of truth, but the UI re-derives the same
 * numbers locally so the provisional fare matches what the server
 * will return.
 *
 *   Days  = number of DISTINCT calendar dates the trip spans
 *           (local time). Same-day = 1, overnight = 2, etc.
 *   Nights = days − 1 (one less night than days, since the customer
 *           is back home on the final day).
 *
 * Returns `{ days: 1, nights: 0 }` for missing / invalid / inverted
 * inputs so caller math never blows up.
 */
export function computeOutstationDuration(pickupAt, expectedReturnAt) {
  if (!pickupAt || !expectedReturnAt) return { days: 1, nights: 0 };
  const start = new Date(pickupAt);
  const end = new Date(expectedReturnAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { days: 1, nights: 0 };
  }
  if (end.getTime() <= start.getTime()) return { days: 1, nights: 0 };

  const startMidnight = new Date(start);
  startMidnight.setHours(0, 0, 0, 0);
  const endMidnight = new Date(end);
  endMidnight.setHours(0, 0, 0, 0);
  const calendarSpan = Math.round(
    (endMidnight.getTime() - startMidnight.getTime()) / 86_400_000,
  );
  const days = Math.max(1, calendarSpan + 1);
  return { days, nights: Math.max(0, days - 1) };
}

/**
 * Pad a number with a leading zero — used to build values accepted
 * by `<input type="datetime-local">` (YYYY-MM-DDTHH:mm).
 */
function pad(n) {
  return String(n).padStart(2, '0');
}

/**
 * Convert an ISO string / Date to the format `<input type="datetime-local">`
 * expects (no timezone suffix, local time). Returns null when the
 * input can't be parsed.
 */
export function toDateTimeInputValue(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatLocalDateTimeInput(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Earliest pickup the customer is allowed to pick, given the
 * admin-configured outstation lead time (`scheduledDispatch
 * .MIN_SCHEDULED_LEAD_HOURS` on the outstation `ServicePricing` doc).
 * The backend enforces the same lower bound on create — keeping the
 * input's `min` attribute in lockstep avoids a confusing "pick a later
 * time" 422 after the user already submitted.
 *
 * Returns a value formatted for `<input type="datetime-local">` (local
 * time, no timezone suffix).
 */
export function minPickupInputValue(leadHours = 1) {
  const safeLead = Math.max(0, Number(leadHours) || 0);
  const d = new Date(Date.now() + safeLead * 60 * 60 * 1000);
  return formatLocalDateTimeInput(d);
}

/**
 * Default pickup datetime — `leadHours` from now, rounded to the
 * next whole hour. Falls back to "1 hour from now" when lead is
 * unspecified so the picker still lands on a usable value before the
 * pricing payload arrives.
 */
export function defaultPickupInputValue(leadHours = 1) {
  const safeLead = Math.max(0, Number(leadHours) || 0);
  const d = new Date(Date.now() + safeLead * 60 * 60 * 1000);
  // Round UP to the next whole hour so the picker doesn't show a stale
  // minute value (matters when `lead` is fractional, e.g. 1.5h).
  if (d.getMinutes() > 0 || d.getSeconds() > 0 || d.getMilliseconds() > 0) {
    d.setHours(d.getHours() + 1, 0, 0, 0);
  } else {
    d.setMinutes(0, 0, 0);
  }
  return formatLocalDateTimeInput(d);
}

/**
 * Default return datetime — same time, next day. Sensible "1-day
 * overnight" starting point that the user can adjust either way.
 */
export function defaultReturnInputValue(pickupInputValue) {
  const base = pickupInputValue
    ? new Date(pickupInputValue)
    : new Date(Date.now() + 60 * 60 * 1000);
  if (Number.isNaN(base.getTime())) return defaultPickupInputValue();
  const d = new Date(base.getTime() + 24 * 60 * 60 * 1000);
  return formatLocalDateTimeInput(d);
}
