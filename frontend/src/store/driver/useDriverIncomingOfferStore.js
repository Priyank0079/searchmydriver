import { create } from 'zustand';
import api from '../../utils/api';

/**
 * Tracks the single in-flight booking offer a driver may currently hold.
 *
 * The dispatcher only ever offers ONE booking at a time to a driver, so we
 * keep the state as a flat object rather than a queue.
 *
 * Drives `BookingOfferModal` which is mounted globally inside the driver
 * dashboard layout so the prompt appears regardless of which page the
 * driver was on when the offer landed.
 */

const useDriverIncomingOfferStore = create((set, get) => ({
  offer: null,
  /** Tracks both accept and reject so the modal can show a loading state. */
  busy: null,
  error: null,
  /** The driver's currently assigned booking once they accept. */
  activeBooking: null,

  setOffer(offer) {
    set({ offer, error: null });
  },

  clearOffer() {
    set({ offer: null, busy: null, error: null });
  },

  setActiveBooking(booking) {
    set({ activeBooking: booking });
  },

  clearActiveBooking() {
    set({ activeBooking: null });
  },

  async fetchActive() {
    try {
      const res = await api.get('/driver/bookings/active');
      const booking = res?.data?.data?.booking || null;
      set({ activeBooking: booking });
      return booking;
    } catch {
      return null;
    }
  },

  async accept() {
    const offer = get().offer;
    if (!offer) return null;
    set({ busy: 'accept', error: null });
    try {
      await api.post(`/driver/bookings/${offer.bookingId}/accept`);
      set({ offer: null, busy: null });
      // The server already broadcasts BOOKING_UPDATED, but we proactively
      // refetch the active booking so the driver lands on the dashboard
      // already showing the trip.
      const booking = await get().fetchActive();
      return booking;
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Failed to accept';
      set({ busy: null, error: message });
      throw err;
    }
  },

  async reject() {
    const offer = get().offer;
    if (!offer) return null;
    set({ busy: 'reject', error: null });
    try {
      await api.post(`/driver/bookings/${offer.bookingId}/reject`);
      set({ offer: null, busy: null });
      return true;
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Failed to reject';
      set({ busy: null, error: message });
      throw err;
    }
  },
}));

export default useDriverIncomingOfferStore;
