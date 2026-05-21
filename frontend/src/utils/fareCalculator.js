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

export function calculateOutstationFare({
  pricing,
  days = 1,
  actualKm = 0,
  foodProvided = true,
  stayProvided = true,
  tollParking = 0,
  subscription = null,
} = {}) {
  if (!pricing) return null;
  const o = pricing.outstation || {};

  const tripDays = Math.max(1, Math.ceil(days));
  const nights = Math.max(0, tripDays - 1);

  const dailyRateTotal = (o.dailyRate || 0) * tripDays;

  let extraKm = 0;
  let extraKmCharge = 0;
  if (o.kmIncludedPerDay > 0 && actualKm > 0) {
    const includedTotal = o.kmIncludedPerDay * tripDays;
    extraKm = Math.max(0, actualKm - includedTotal);
    extraKmCharge = extraKm * (o.extraKmRate || 0);
  }

  const nightHaltTotal = (o.nightHaltCharge || 0) * nights;

  const foodAllowanceTotal =
    pricing.foodAllowance?.enabled && foodProvided === false
      ? (pricing.foodAllowance.amount || 0) * tripDays
      : 0;

  const stayChargeTotal =
    stayProvided === false ? (o.stayChargePerNight || 0) * nights : 0;

  const toll = pricing.tollParkingEnabled ? Math.max(0, tollParking || 0) : 0;

  const subtotal =
    dailyRateTotal +
    extraKmCharge +
    nightHaltTotal +
    foodAllowanceTotal +
    stayChargeTotal +
    toll;

  const layers = applyPlatformLayers(subtotal, pricing, subscription);

  return {
    serviceType: SERVICE_TYPES.OUTSTATION,
    days: tripDays,
    nights,
    dailyRate: round2(o.dailyRate || 0),
    dailyRateTotal: round2(dailyRateTotal),
    kmIncludedTotal: round2((o.kmIncludedPerDay || 0) * tripDays),
    extraKm: round2(extraKm),
    extraKmCharge: round2(extraKmCharge),
    nightHaltCharge: round2(o.nightHaltCharge || 0),
    nightHaltTotal: round2(nightHaltTotal),
    foodAllowancePerDay: round2(pricing.foodAllowance?.amount || 0),
    foodAllowanceTotal: round2(foodAllowanceTotal),
    stayChargePerNight: round2(o.stayChargePerNight || 0),
    stayChargeTotal: round2(stayChargeTotal),
    tollParking: round2(toll),
    foodProvided,
    stayProvided,
    subtotal: round2(subtotal),
    ...layers,
  };
}

export const formatCurrency = (n) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
