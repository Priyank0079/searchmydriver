export const PAYMENT_STATUS = Object.freeze({
  PENDING: 'pending',
  PAID: 'paid',
  FAILED: 'failed',
  REFUNDED: 'refunded',
});

export const KIT_ADMIN_STATUS = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
});

export const FULFILLMENT_STATUS = Object.freeze({
  NOT_STARTED: 'not_started',
  DISPATCHED: 'dispatched',
  IN_TRANSIT: 'in_transit',
  DELIVERED: 'delivered',
  FAILED: 'failed',
});

export const PAYMENT_PROVIDER = Object.freeze({
  RAZORPAY: 'razorpay',
});

export const PAYMENT_PURPOSE = Object.freeze({
  DRIVER_KIT: 'driver_kit',
  TRIP_FARE: 'trip_fare',
  WITHDRAWAL: 'withdrawal',
});
