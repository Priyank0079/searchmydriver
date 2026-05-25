import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { SERVICE_TYPES } from '../../constants/serviceTypes';
import { BOOKING_TYPE } from '../../constants/bookingStatus';

/**
 * Holds the user's in-progress booking selections as they walk through the
 * hourly / outstation flows. Persisted to sessionStorage so a refresh mid-flow
 * doesn't kick them back to step 1.
 *
 *   Hourly:    type → details (pickup + drop + car) → slab → review
 *   Outstation: variants → pickup → review (unchanged)
 *
 * Reset is the responsibility of the success/cancel pages — never auto-reset
 * on mount.
 */

const DEFAULT_STATE = {
  serviceType: null,
  /** 'instant' or 'scheduled' — picked on the first hourly screen. */
  bookingType: null,
  pickup: null, // { address, city, lat, lng }
  dropoff: null, // { address, city, lat, lng }
  carId: null,
  hourly: {
    scheduledStartAt: null,
    durationHours: null,
    slabId: null,
    isCustomDuration: false,
  },
  outstation: {
    destinationAddress: '',
    destinationLat: null,
    destinationLng: null,
    startDate: null,
    endDate: null,
    days: null,
    nights: null,
    needsStay: true,
    needsFood: true,
    estimatedKm: 0,
  },
  fareEstimate: null,
};

const useBookingDraftStore = create(
  persist(
    (set, get) => ({
      ...DEFAULT_STATE,

      setServiceType(serviceType) {
        if (![SERVICE_TYPES.HOURLY, SERVICE_TYPES.OUTSTATION].includes(serviceType)) return;
        // Switching service types nukes the type-specific fields so we don't
        // submit hourly + outstation data together.
        set({
          serviceType,
          bookingType: null,
          hourly: { ...DEFAULT_STATE.hourly },
          outstation: { ...DEFAULT_STATE.outstation },
          dropoff: null,
          fareEstimate: null,
        });
      },

      setBookingType(bookingType) {
        if (![BOOKING_TYPE.INSTANT, BOOKING_TYPE.SCHEDULED].includes(bookingType)) return;
        set({ bookingType });
      },

      setPickup(pickup) {
        set({ pickup, fareEstimate: null });
      },

      setDropoff(dropoff) {
        // Mirror into outstation.destinationAddress so the create payload keeps
        // working without a backend change.
        const next = { dropoff, fareEstimate: null };
        if (get().serviceType === SERVICE_TYPES.OUTSTATION) {
          next.outstation = {
            ...get().outstation,
            destinationAddress: dropoff?.address || '',
            destinationLat: dropoff?.lat ?? null,
            destinationLng: dropoff?.lng ?? null,
          };
        }
        set(next);
      },

      setCarId(carId) {
        set({ carId: carId || null });
      },

      setHourly(patch) {
        set({ hourly: { ...get().hourly, ...patch }, fareEstimate: null });
      },

      setOutstation(patch) {
        set({ outstation: { ...get().outstation, ...patch }, fareEstimate: null });
      },

      setFareEstimate(fareEstimate) {
        set({ fareEstimate });
      },

      reset() {
        set({ ...DEFAULT_STATE });
      },

      /** Build the payload the booking-create endpoint expects. */
      buildCreatePayload() {
        const s = get();
        const pickupPayload = s.pickup
          ? {
              address: s.pickup.address,
              city: s.pickup.city || '',
              location: {
                type: 'Point',
                coordinates: [s.pickup.lng, s.pickup.lat],
              },
            }
          : null;

        // Hourly today defaults dropoff to pickup. Outstation keeps a real
        // dropoff. Either way we send a `dropoff` block so the backend can
        // persist it.
        const dropPoint = s.dropoff || (s.serviceType === SERVICE_TYPES.HOURLY ? s.pickup : null);
        const dropoffPayload = dropPoint
          ? {
              address: dropPoint.address,
              city: dropPoint.city || '',
              location: {
                type: 'Point',
                coordinates: [dropPoint.lng, dropPoint.lat],
              },
            }
          : null;

        const payload = {
          serviceType: s.serviceType,
          bookingType: s.bookingType || BOOKING_TYPE.INSTANT,
          carId: s.carId || null,
          pickup: pickupPayload,
          dropoff: dropoffPayload,
        };

        if (s.serviceType === SERVICE_TYPES.HOURLY) {
          payload.hourly = {
            scheduledStartAt: s.hourly.scheduledStartAt,
            durationHours: s.hourly.durationHours,
            slabId: s.hourly.isCustomDuration ? null : s.hourly.slabId,
            isCustomDuration: !!s.hourly.isCustomDuration,
          };
        }
        if (s.serviceType === SERVICE_TYPES.OUTSTATION) {
          payload.outstation = {
            destinationAddress: s.outstation.destinationAddress,
            startDate: s.outstation.startDate,
            endDate: s.outstation.endDate,
            days: s.outstation.days,
            nights: s.outstation.nights,
            needsStay: s.outstation.needsStay,
            needsFood: s.outstation.needsFood,
            estimatedKm: s.outstation.estimatedKm || 0,
          };
        }
        return payload;
      },
    }),
    {
      name: 'spareDriver.bookingDraft',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);

export default useBookingDraftStore;
