import { ACTIVE_BOOKING_STATUSES } from '../constants/bookingStatus';

/**
 * Merge a socket-updated "active booking" (from the active-booking
 * store) into a periodically-refetched bookings list so the list row
 * always renders the freshest lifecycle phase.
 *
 * Both `/user/activity` and `/driver/trips` need this: the list
 * refetches on `BOOKING_UPDATED` events but can briefly lag the store,
 * which receives the socket patch first. When the same booking id is
 * present in both, we keep whichever has the further-along
 * `ACTIVE_BOOKING_STATUSES` rank. If the store has an active booking
 * the list hasn't picked up yet, we prepend it.
 */
export function mergeLiveBookingIntoList(activeBooking, listBookings) {
  const list = Array.isArray(listBookings) ? listBookings : [];
  const storeLive =
    activeBooking && ACTIVE_BOOKING_STATUSES.includes(activeBooking.status)
      ? activeBooking
      : null;
  if (!storeLive) return list;
  const idx = list.findIndex(
    (b) => b && String(b._id) === String(storeLive._id),
  );
  if (idx === -1) return [storeLive, ...list];
  const listEntry = list[idx];
  const storeRank = ACTIVE_BOOKING_STATUSES.indexOf(storeLive.status);
  const listRank = ACTIVE_BOOKING_STATUSES.indexOf(listEntry.status);
  if (storeRank <= listRank) return list;
  const next = list.slice();
  next[idx] = storeLive;
  return next;
}
