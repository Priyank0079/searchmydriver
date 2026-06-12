/**
 * Client-side mirror of backend `pricing.service.js`.
 * Keep math in sync with backend; this exists for instant admin preview
 * and frontend booking review (no HTTP round-trip needed).
 */
import { SERVICE_TYPES } from '../constants/serviceTypes';

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

export function isNightRideAt(date, nightConfig) {
  if (!nightConfig?.enabled) return false;
  const [startH, startM] = (nightConfig.startTime || '22:00').split(':').map(Number);
  const [endH, endM] = (nightConfig.endTime || '06:00').split(':').map(Number);
  const at = new Date(date);
  const cur = at.getHours() * 60 + at.getMinutes();
  const start = startH * 60 + startM;
  const end = endH * 60 + endM;
  if (start === end) return false;
  return start < end ? cur >= start && cur < end : cur >= start || cur < end;
}

function applySubscriptionDiscount(subtotal, subscription) {
  if (!subscription) return 0;
  const value = subscription.bookingDiscountValue || 0;
  if (value <= 0) return 0;
  const discount =
    subscription.bookingDiscountType === 'percentage'
      ? (subtotal * value) / 100
      : value;
  return Math.min(discount, subtotal);
}

function applyPlatformLayers(subtotal, pricing, subscription) {
  const serviceChargePercent = pricing.serviceChargePercent || 0;
  const gstPercent = pricing.gstPercent || 0;
  const serviceCharge = (subtotal * serviceChargePercent) / 100;
  const gstAmount = ((subtotal + serviceCharge) * gstPercent) / 100;
  const subscriptionDiscount = applySubscriptionDiscount(subtotal, subscription);
  const totalPayable = Math.max(0, subtotal + serviceCharge + gstAmount - subscriptionDiscount);
  const platformCommissionPercent = pricing.platformCommissionPercent || 0;
  const platformCommission = (subtotal * platformCommissionPercent) / 100;
  const driverEarning = Math.max(0, subtotal - platformCommission);

  return {
    serviceCharge: round2(serviceCharge),
    serviceChargePercent,
    gstAmount: round2(gstAmount),
    gstPercent,
    subscriptionDiscount: round2(subscriptionDiscount),
    totalPayable: round2(totalPayable),
    platformCommission: round2(platformCommission),
    platformCommissionPercent,
    driverEarning: round2(driverEarning),
  };
}

export function calculateHourlyFare({
  pricing,
  slab = null,
  actualDurationMin = null,
  bookedHours = null,
  isNightRide = false,
  waitingMinutes = 0,
  tollParking = 0,
  subscription = null,
} = {}) {
  if (!pricing) return null;

  const slabPrice = slab?.price ?? 0;
  const slabMaxHours = slab?.maxHours ?? bookedHours ?? 0;

  let extraHours = 0;
  let extraHourCharge = 0;
  if (actualDurationMin != null && slabMaxHours > 0) {
    const overflowMin = Math.max(0, actualDurationMin - slabMaxHours * 60);
    extraHours = Math.ceil(overflowMin / 60);
    extraHourCharge = extraHours * (pricing.extraHourCharge || 0);
  }

  const freeWait = pricing.waitingCharge?.freeWaitingMinutes ?? 0;
  const perMin = pricing.waitingCharge?.chargePerMinute ?? 0;
  const billableWait = Math.max(0, (waitingMinutes || 0) - freeWait);
  const waitingCharge = billableWait * perMin;

  let nightCharge = 0;
  if (isNightRide && pricing.nightCharge?.enabled) {
    nightCharge =
      pricing.nightCharge.type === 'percentage'
        ? (slabPrice * (pricing.nightCharge.amount || 0)) / 100
        : pricing.nightCharge.amount || 0;
  }

  const toll = pricing.tollParkingEnabled ? Math.max(0, tollParking || 0) : 0;

  const subtotal = slabPrice + extraHourCharge + waitingCharge + nightCharge + toll;
  const layers = applyPlatformLayers(subtotal, pricing, subscription);

  return {
    serviceType: SERVICE_TYPES.HOURLY,
    packagePrice: round2(slabPrice),
    extraHours,
    extraHourCharge: round2(extraHourCharge),
    waitingMinutes: waitingMinutes || 0,
    waitingCharge: round2(waitingCharge),
    nightCharge: round2(nightCharge),
    tollParking: round2(toll),
    subtotal: round2(subtotal),
    ...layers,
  };
}

/**
 * Mirrors the simplified backend outstation pricing model:
 *   subtotal = dailyRate × days
 *            + (customer arranges all ? 0 : allowancePerNight × nights)
 * Toll & parking are NOT added — they're paid by the customer directly
 * to the driver.
 */
export function calculateOutstationFare({
  pricing,
  days = 1,
  // `actualKm` and `tollParking` accepted for back-compat; both are
  // no-ops in the current pricing model.
  actualKm: _actualKm = 0, // eslint-disable-line no-unused-vars
  foodProvided = true,
  stayProvided = true,
  tollParking: _tollParking = 0, // eslint-disable-line no-unused-vars
  subscription = null,
} = {}) {
  if (!pricing) return null;
  const o = pricing.outstation || {};

  const tripDays = Math.max(1, Math.ceil(days));
  const nights = Math.max(0, tripDays - 1);

  const dailyRate = Number(o.dailyRate) || 0;
  const allowancePerNight = Number(o.allowancePerNight) || 0;

  const dailyRateTotal = dailyRate * tripDays;
  // Convention mirrors the backend engine: both flags must be exactly
  // `true` to waive the per-night allowance.
  const customerArrangesAll = foodProvided === true && stayProvided === true;
  const allowanceTotal = customerArrangesAll
    ? 0
    : allowancePerNight * nights;

  const subtotal = dailyRateTotal + allowanceTotal;
  const layers = applyPlatformLayers(subtotal, pricing, subscription);

  return {
    serviceType: SERVICE_TYPES.OUTSTATION,
    days: tripDays,
    nights,
    dailyRate: round2(dailyRate),
    dailyRateTotal: round2(dailyRateTotal),
    allowancePerNight: round2(allowancePerNight),
    allowanceTotal: round2(allowanceTotal),
    customerArrangesAll,
    foodProvided: foodProvided === true,
    stayProvided: stayProvided === true,
    // Legacy fields — always 0 in the new model.
    kmIncludedTotal: 0,
    extraKm: 0,
    extraKmCharge: 0,
    nightHaltCharge: 0,
    nightHaltTotal: 0,
    foodAllowancePerDay: 0,
    foodAllowanceTotal: 0,
    stayChargePerNight: 0,
    stayChargeTotal: 0,
    tollParking: 0,
    subtotal: round2(subtotal),
    ...layers,
  };
}

export const formatCurrency = (n) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
