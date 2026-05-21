/** Booking service types — keep in sync with frontend/src/constants/serviceTypes.js */
export const SERVICE_TYPES = Object.freeze({
  HOURLY: 'hourly',
  OUTSTATION: 'outstation',
});

export const SERVICE_TYPE_LIST = Object.freeze(Object.values(SERVICE_TYPES));

export const SERVICE_TYPE_LABELS = Object.freeze({
  [SERVICE_TYPES.HOURLY]: 'Hourly',
  [SERVICE_TYPES.OUTSTATION]: 'Outstation',
});

export const SUBSCRIPTION_DISCOUNT_TYPES = Object.freeze({
  PERCENTAGE: 'percentage',
  FLAT: 'flat',
});

export const SUBSCRIPTION_STATUS = Object.freeze({
  ACTIVE: 'active',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
});

export const SUBSCRIPTION_ASSIGNMENT_STATUS = Object.freeze({
  PENDING: 'pending', // paid but no driver assigned yet
  ASSIGNED: 'assigned', // dedicated driver assigned
  RELEASED: 'released', // assignment ended (e.g. user/admin released the driver)
});
