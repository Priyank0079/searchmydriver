import { create } from 'zustand';
import api from '../../utils/api';

/**
 * Source of truth for the user's currently-active booking on the client.
 *
 * Reads:
 *   - GET /auth/bookings/active     → initial hydration on page load
 *   - Socket S2C_EVENTS.BOOKING_UPDATED → live patches over the socket
 *
 * Writes (helpers that page components call):
 *   - createBooking      → POST /auth/bookings + replace local state
 *   - cancelBooking      → POST /auth/bookings/:id/cancel
 *   - createPaymentOrder → POST /auth/bookings/:id/pay
 *   - verifyPayment      → POST /auth/bookings/:id/verify-payment
 *
 * Pages should treat `applyUpdate` and `setBooking` as the only mutators of
 * `booking` — keeps the socket and REST paths consistent.
 */

const useUserActiveBookingStore = create((set, get) => ({
  booking: null,
  loading: false,
  error: null,
  paymentRequiredAt: null,

  setBooking(booking) {
    set({ booking, paymentRequiredAt: null });
  },

  clear() {
    set({ booking: null, loading: false, error: null, paymentRequiredAt: null });
  },

  /**
   * Apply a partial server patch (BOOKING_UPDATED socket payload).
   *
   * Fields we explicitly know how to merge are listed below. Everything we
   * don't recognise is ignored on purpose — we never blindly spread the
   * payload onto `booking` because some patches deliberately omit
   * user-private fields like `rideStartOtp.code` when they originate from
   * the booking room.
   */
  applyUpdate(patch = {}) {
    const current = get().booking;
    if (!current) return;
    if (patch.bookingId && String(patch.bookingId) !== String(current._id)) return;
    const merged = { ...current };
    if (patch.status) merged.status = patch.status;
    if (patch.paymentStatus) merged.paymentStatus = patch.paymentStatus;
    if (patch.paymentMode) merged.paymentMode = patch.paymentMode;
    // `driverId` can legitimately go from a value back to `null` (driver
    // bailed → booking back to SEARCHING). Honour an explicit `null` in
    // the patch instead of only forwarding truthy ids.
    if ('driverId' in patch) merged.driverId = patch.driverId;
    if (patch.dispatch) {
      merged.dispatch = { ...(current.dispatch || {}), ...patch.dispatch };
    }
    if (patch.timeline) {
      merged.timeline = { ...(current.timeline || {}), ...patch.timeline };
    }
    // Same null-handling rule for `cancellation`. The re-dispatch flow
    // sends `cancellation: null` once a new driver accepts so the
    // "driver bailed" popup goes away.
    if ('cancellation' in patch) {
      merged.cancellation = patch.cancellation
        ? { ...(current.cancellation || {}), ...patch.cancellation }
        : null;
    }
    if (patch.cancellationPreview) {
      merged.cancellationPreview = patch.cancellationPreview;
    }
    if (patch.refund) {
      // Lightweight refund summary attached on a cancellation socket
      // patch — the FE renders the amount in the cancellation toast.
      merged.refund = patch.refund;
    }
    if (patch.rideStartOtp) {
      merged.rideStartOtp = {
        ...(current.rideStartOtp || {}),
        ...patch.rideStartOtp,
      };
    }
    if (Array.isArray(patch.extensions)) {
      merged.extensions = patch.extensions;
    }
    if (typeof patch.amountDue === 'number') merged.amountDue = patch.amountDue;
    if (typeof patch.effectiveTotal === 'number') merged.effectiveTotal = patch.effectiveTotal;
    set({ booking: merged });
  },

  notePaymentRequired(meta) {
    set({ paymentRequiredAt: { ...meta, at: Date.now() } });
  },

  async fetchActive() {
    set({ loading: true, error: null });
    try {
      const res = await api.get('/auth/bookings/active');
      const booking = res?.data?.data?.booking || null;
      set({ booking, loading: false });
      return booking;
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Failed to load booking';
      set({ error: message, loading: false });
      throw err;
    }
  },

  async createBooking(payload) {
    set({ loading: true, error: null });
    try {
      const res = await api.post('/auth/bookings', payload);
      const booking = res?.data?.data?.booking || null;
      const reused = !!res?.data?.data?.reused;
      set({ booking, loading: false });
      return { booking, reused };
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Booking failed';
      set({ error: message, loading: false });
      throw err;
    }
  },

  async cancelBooking(reason = 'cancelled_by_user') {
    const id = get().booking?._id;
    if (!id) return null;
    const res = await api.post(`/auth/bookings/${id}/cancel`, { reason });
    const booking = res?.data?.data?.booking || null;
    set({ booking });
    return booking;
  },

  async createPaymentOrder() {
    const id = get().booking?._id;
    if (!id) throw new Error('No active booking');
    const res = await api.post(`/auth/bookings/${id}/pay`);
    return res?.data?.data?.razorpay;
  },

  async verifyPayment({ orderId, paymentId, signature }) {
    const id = get().booking?._id;
    if (!id) throw new Error('No active booking');
    const res = await api.post(`/auth/bookings/${id}/verify-payment`, {
      orderId,
      paymentId,
      signature,
    });
    const booking = res?.data?.data?.booking || null;
    set({ booking });
    return booking;
  },

  /**
   * User chose to extend the ride past the originally booked duration.
   * Server appends an entry to `booking.extensions[]` and emits a patch.
   */
  async createExtension(additionalHours) {
    const id = get().booking?._id;
    if (!id) throw new Error('No active booking');
    const res = await api.post(`/auth/bookings/${id}/extensions`, {
      additionalHours,
    });
    const booking = res?.data?.data?.booking || null;
    if (booking) set({ booking });
    return booking;
  },
}));

export default useUserActiveBookingStore;
