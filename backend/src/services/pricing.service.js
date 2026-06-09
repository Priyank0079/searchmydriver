import ServicePricing from '../models/servicePricing.model.js';
import SubscriptionPlan from '../models/subscriptionPlan.model.js';
import UserSubscription from '../models/userSubscription.model.js';
import { ApiError } from '../utils/apiError.js';
import {
  SERVICE_TYPES,
  SERVICE_TYPE_LIST,
  SUBSCRIPTION_DISCOUNT_TYPES,
  SUBSCRIPTION_STATUS,
} from '../constants/serviceTypes.js';

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// ─── Service pricing CRUD ─────────────────────────────────────────────────────

export const listServicePricingsService = async ({ onlyActive = false } = {}) => {
  const filter = onlyActive ? { isActive: true } : {};
  // Hide rows whose serviceType is no longer in the active enum (e.g. legacy point_to_point).
  filter.serviceType = { $in: SERVICE_TYPE_LIST };
  return ServicePricing.find(filter).sort({ sortOrder: 1, createdAt: 1 });
};

export const getServicePricingByTypeService = async (serviceType) => {
  if (!SERVICE_TYPE_LIST.includes(serviceType)) {
    throw new ApiError(400, 'Invalid service type');
  }
  return ServicePricing.findOne({ serviceType });
};

export const upsertServicePricingService = async (data, staffId) => {
  const { serviceType } = data || {};
  if (!SERVICE_TYPE_LIST.includes(serviceType)) {
    throw new ApiError(
      400,
      'serviceType is required and must be one of: ' + SERVICE_TYPE_LIST.join(', '),
    );
  }
  if (!data.name?.trim()) {
    throw new ApiError(400, 'name is required');
  }

  validatePricingForType(serviceType, data);

  const existing = await ServicePricing.findOne({ serviceType });
  if (existing) {
    existing.set({
      ...data,
      updatedBy: staffId || existing.updatedBy,
    });
    await existing.save();
    return existing;
  }
  return ServicePricing.create({
    ...data,
    createdBy: staffId || null,
  });
};

export const updateServicePricingService = async (id, data, staffId) => {
  // Service type cannot be changed once created (unique key).
  if (data.serviceType) delete data.serviceType;

  const existing = await ServicePricing.findById(id);
  if (!existing) throw new ApiError(404, 'Service pricing not found');

  validatePricingForType(existing.serviceType, { ...existing.toObject(), ...data });

  existing.set({ ...data, updatedBy: staffId || null });
  await existing.save();
  return existing;
};

export const deleteServicePricingService = async (id) => {
  const deleted = await ServicePricing.findByIdAndDelete(id);
  if (!deleted) throw new ApiError(404, 'Service pricing not found');
  return { id };
};

function validatePricingForType(serviceType, data) {
  // Waiting-charge policy is shared across service types — every service
  // gets a buffer collected upfront. Validate before the per-type checks
  // so a buffer/cadence mismatch is surfaced as a single clear 400.
  validateWaitingCharge(data.waitingCharge);
  if (serviceType === SERVICE_TYPES.HOURLY) {
    validateSlabs(data.slabs);
    validateCustomHours(data.customHours);
    validateHourlyFoodAllowance(data.foodAllowance);
    validateHourlyStayAllowance(data.stayAllowance);
  } else if (serviceType === SERVICE_TYPES.OUTSTATION) {
    const o = data.outstation || {};
    if (o.dailyRate == null || o.dailyRate < 0) {
      throw new ApiError(400, 'Outstation: dailyRate must be a non-negative number');
    }
    if (o.minDays && o.maxDays && o.maxDays > 0 && o.maxDays < o.minDays) {
      throw new ApiError(400, 'Outstation: maxDays must be greater than minDays');
    }
    if (o.kmIncludedPerDay > 0 && (!o.extraKmRate || o.extraKmRate < 0)) {
      throw new ApiError(
        400,
        'Outstation: extraKmRate is required when kmIncludedPerDay is set',
      );
    }
  }
}

function validateSlabs(slabs) {
  if (!Array.isArray(slabs) || slabs.length === 0) {
    throw new ApiError(400, 'At least one slab is required for hourly pricing');
  }
  slabs.forEach((s, idx) => {
    if (s.minHours == null || s.maxHours == null) {
      throw new ApiError(400, `Slab #${idx + 1}: minHours and maxHours are required`);
    }
    if (s.maxHours <= s.minHours) {
      throw new ApiError(400, `Slab #${idx + 1}: maxHours must be greater than minHours`);
    }
    if (s.price == null || s.price < 0) {
      throw new ApiError(400, `Slab #${idx + 1}: price must be a non-negative number`);
    }
  });
}

function validateCustomHours(cfg) {
  if (!cfg?.enabled) return;
  if (!cfg.ratePerHour || cfg.ratePerHour <= 0) {
    throw new ApiError(400, 'Custom hours: ratePerHour must be greater than 0');
  }
  if (cfg.maxHours != null && cfg.maxHours < 0) {
    throw new ApiError(400, 'Custom hours: maxHours cannot be negative');
  }
}

function validateHourlyFoodAllowance(cfg) {
  if (!cfg?.enabled) return;
  // Hourly food allowance is no longer charged — only the threshold
  // matters (it controls when the "please provide driver's food"
  // notice fires on the customer UI).
  if (cfg.thresholdHours == null || cfg.thresholdHours <= 0) {
    throw new ApiError(
      400,
      'Food allowance: thresholdHours must be greater than 0',
    );
  }
}

function validateHourlyStayAllowance(cfg) {
  if (!cfg?.enabled) return;
  if (!cfg.amount || cfg.amount < 0) {
    throw new ApiError(400, 'Accommodation allowance: amount must be greater than 0');
  }
  if (cfg.thresholdHours == null || cfg.thresholdHours <= 0) {
    throw new ApiError(
      400,
      'Accommodation allowance: thresholdHours must be greater than 0',
    );
  }
}

/**
 * Enforce the buffer-vs-cadence invariant. The buffer collected at
 * booking creation must always cover the worst-case waiting window the
 * cadence can produce, otherwise the no-show flow could try to settle
 * more than what was pre-collected. The worst case is:
 *
 *   freeWait gone → (maxNoShowPrompts + 1) prompts × promptMinutes
 *                 + 1 final graceMinutes
 *
 * (`freeWaitingMinutes` is excluded because no minute inside it is
 * billable — the cap only has to cover the *billable* tail.)
 */
function validateWaitingCharge(cfg) {
  if (!cfg) return; // Mongoose default kicks in.
  const free = Math.max(0, Number(cfg.freeWaitingMinutes) || 0);
  const perMin = Math.max(0, Number(cfg.chargePerMinute) || 0);
  const promptMins = Math.max(0, Number(cfg.noShowPromptMinutes) || 0);
  const graceMins = Math.max(0, Number(cfg.noShowGraceMinutes) || 0);
  const maxPrompts = Math.max(0, Math.min(5, Number(cfg.maxNoShowPrompts) || 0));
  const maxBillable = Math.max(0, Number(cfg.maxBillableMinutes) || 0);

  if (perMin > 0 && maxBillable <= 0) {
    throw new ApiError(
      400,
      'Waiting charge: maxBillableMinutes must be greater than 0 when chargePerMinute is set',
    );
  }
  const worstCase = (maxPrompts + 1) * promptMins + graceMins;
  if (maxBillable > 0 && maxBillable < worstCase) {
    throw new ApiError(
      400,
      `Waiting charge: maxBillableMinutes (${maxBillable}) must be ≥ ${worstCase} ` +
        `(= (maxNoShowPrompts+1) × noShowPromptMinutes + noShowGraceMinutes) ` +
        'so the pre-collected buffer always covers the worst-case wait.',
    );
  }
  // Sanity: free wait shouldn't dwarf the whole cadence — that produces a
  // free ride that auto-completes without ever reaching the prompt path.
  if (free > 0 && perMin > 0 && maxBillable > 0 && free >= maxBillable + worstCase) {
    throw new ApiError(
      400,
      'Waiting charge: freeWaitingMinutes is larger than the entire billable window — adjust the cadence.',
    );
  }
}

// ─── Subscription plans CRUD ──────────────────────────────────────────────────

export const listSubscriptionPlansService = async ({ onlyActive = false } = {}) => {
  const filter = onlyActive ? { isActive: true } : {};
  return SubscriptionPlan.find(filter).sort({ sortOrder: 1, durationMonths: 1 });
};

export const createSubscriptionPlanService = async (data, staffId) => {
  if (!data.name?.trim()) throw new ApiError(400, 'name is required');
  if (!data.durationMonths || data.durationMonths < 1) {
    throw new ApiError(400, 'durationMonths must be at least 1');
  }
  if (data.price == null || data.price < 0) {
    throw new ApiError(400, 'price must be a non-negative number');
  }
  if (data.bookingDiscountValue != null && data.bookingDiscountValue < 0) {
    throw new ApiError(400, 'bookingDiscountValue must be a non-negative number');
  }
  if (
    data.includedHoursPerDay != null &&
    (data.includedHoursPerDay < 0 || data.includedHoursPerDay > 24)
  ) {
    throw new ApiError(400, 'includedHoursPerDay must be between 0 and 24');
  }
  return SubscriptionPlan.create({ ...data, createdBy: staffId || null });
};

export const updateSubscriptionPlanService = async (id, data, staffId) => {
  if (data.price != null && data.price < 0) {
    throw new ApiError(400, 'price must be a non-negative number');
  }
  if (data.bookingDiscountValue != null && data.bookingDiscountValue < 0) {
    throw new ApiError(400, 'bookingDiscountValue must be a non-negative number');
  }
  const updated = await SubscriptionPlan.findByIdAndUpdate(
    id,
    { ...data, updatedBy: staffId || null },
    { new: true, runValidators: true },
  );
  if (!updated) throw new ApiError(404, 'Subscription plan not found');
  return updated;
};

export const deleteSubscriptionPlanService = async (id) => {
  const deleted = await SubscriptionPlan.findByIdAndDelete(id);
  if (!deleted) throw new ApiError(404, 'Subscription plan not found');
  return { id };
};

// ─── Active subscription helpers ──────────────────────────────────────────────

export const getActiveUserSubscriptionService = async (userId) => {
  if (!userId) return null;
  const now = new Date();
  return UserSubscription.findOne({
    userId,
    status: SUBSCRIPTION_STATUS.ACTIVE,
    expiryDate: { $gt: now },
  })
    .populate('planId', 'name includedHoursPerDay bookingDiscountType bookingDiscountValue')
    .populate('assignedDriverId', 'name phone profilePicture rating');
};

// ─── Fare calculation helpers ─────────────────────────────────────────────────

export function findSlabForDuration(slabs = [], hours = 0) {
  if (!Array.isArray(slabs) || slabs.length === 0) return null;
  const sorted = [...slabs].sort((a, b) => a.minHours - b.minHours);
  const match = sorted.find((s) => hours > s.minHours && hours <= s.maxHours);
  if (match) return match;
  if (hours <= sorted[0].maxHours) return sorted[0];
  return sorted[sorted.length - 1];
}

function minutesOfDay(date) {
  const at = new Date(date);
  return at.getHours() * 60 + at.getMinutes();
}

function parseHHmm(s, fallback) {
  const [h, m] = (s || fallback).split(':').map(Number);
  return h * 60 + m;
}

/**
 * Returns true when the given timestamp falls inside the night window.
 * Handles wrap-around (e.g. 22:00 → 06:00) by splitting the window
 * around midnight.
 */
export function isNightRideAt(date, nightConfig) {
  if (!nightConfig?.enabled) return false;
  const start = parseHHmm(nightConfig.startTime, '22:00');
  const end = parseHHmm(nightConfig.endTime, '06:00');
  if (start === end) return false;
  const cur = minutesOfDay(date);
  return start < end ? cur >= start && cur < end : cur >= start || cur < end;
}

/**
 * Does any part of a ride that starts at `startAt` and lasts `durationHours`
 * cross the night window? Lets a 6-hour booking that starts at 18:00 still
 * trigger the night charge because the last few hours dip into the night.
 *
 * Implementation: walk hour-by-hour across the booking, returning true the
 * moment any minute hits the window. Cheap (max ~24 iterations) and avoids
 * the corner-case-laden arithmetic of overlapping two wrap-around ranges.
 */
export function rideCoversNightWindow(startAt, durationHours, nightConfig) {
  if (!nightConfig?.enabled) return false;
  const duration = Math.max(0, Math.ceil(Number(durationHours) || 0));
  if (!duration) return isNightRideAt(startAt, nightConfig);
  const startMs = startAt ? new Date(startAt).getTime() : Date.now();
  // Sample every 15 minutes so we never miss a short window (e.g. 23:50–00:10).
  const stepMs = 15 * 60 * 1000;
  const totalMs = duration * 60 * 60 * 1000;
  for (let t = 0; t <= totalMs; t += stepMs) {
    if (isNightRideAt(new Date(startMs + t), nightConfig)) return true;
  }
  return false;
}

/**
 * Does this booking qualify for a night charge purely on the basis of
 * its booked duration? Admin sets `nightCharge.thresholdHours` (0 to
 * disable). Independent of `isNightRideAt` — either trigger fires the
 * charge.
 */
export function isLongDurationNight(bookedHours, nightConfig) {
  if (!nightConfig?.enabled) return false;
  const threshold = Number(nightConfig.thresholdHours) || 0;
  if (threshold <= 0) return false;
  return Number(bookedHours) >= threshold;
}

function applySubscriptionDiscount(subtotal, subscription) {
  if (!subscription || subscription.status !== SUBSCRIPTION_STATUS.ACTIVE) return 0;
  const value = subscription.bookingDiscountValue || 0;
  if (value <= 0) return 0;
  const discount =
    subscription.bookingDiscountType === SUBSCRIPTION_DISCOUNT_TYPES.PERCENTAGE
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

// ─── HOURLY fare ──────────────────────────────────────────────────────────────

export function calculateHourlyFare({
  pricing,
  slab = null,
  isCustomDuration = false,
  actualDurationMin = null,
  bookedHours = null,
  isNightRide = false,
  waitingMinutes = 0,
  tollParking = 0,
  /**
   * User overrides for the long-booking driver allowances. Default to
   * `true` so a missing flag means "the user IS providing it" and we
   * don't accidentally charge extra. Only takes effect once the
   * configured `thresholdHours` is crossed AND `userOptOut` is on.
   */
  foodProvided = true,
  stayProvided = true,
  subscription = null,
} = {}) {
  if (!pricing) throw new ApiError(400, 'Service pricing is required for fare calculation');

  // Package price: slab → fixed, custom → hourly rate × bookedHours.
  let packagePrice = 0;
  let slabMaxHours = 0;
  if (isCustomDuration) {
    const rate = pricing.customHours?.ratePerHour || 0;
    const hours = Math.max(1, Math.ceil(bookedHours || 0));
    packagePrice = rate * hours;
    slabMaxHours = hours;
  } else {
    packagePrice = slab?.price ?? 0;
    slabMaxHours = slab?.maxHours ?? bookedHours ?? 0;
  }

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

  // Night charge: time-of-day window OR long-duration threshold (both
  // are admin-configurable). Either trigger applies the charge once.
  let nightCharge = 0;
  let nightChargeTriggered = false;
  if (pricing.nightCharge?.enabled) {
    const longRide = isLongDurationNight(bookedHours, pricing.nightCharge);
    if (isNightRide || longRide) {
      nightChargeTriggered = true;
      nightCharge =
        pricing.nightCharge.type === 'percentage'
          ? (packagePrice * (pricing.nightCharge.amount || 0)) / 100
          : pricing.nightCharge.amount || 0;
    }
  }

  // Food allowance for HOURLY is no longer billed — the threshold acts
  // purely as a "your booking is long enough that the driver will need a
  // meal, please arrange food yourself" notice. We surface
  // `foodRequired` / `foodThresholdHours` so the UI can render the
  // warning; the customer is never charged an allowance for hourly.
  const foodAllowance = 0;
  const foodCfg = pricing.foodAllowance;
  const foodThresholdHours = foodCfg?.thresholdHours || 0;
  const foodRequired =
    !!foodCfg?.enabled &&
    bookedHours != null &&
    foodThresholdHours > 0 &&
    Number(bookedHours) >= foodThresholdHours;
  // Kept `foodEligible` in the response shape for back-compat with
  // any older clients that read it — always equal to foodRequired now.
  const foodEligible = foodRequired;

  // Driver accommodation allowance for very long hourly bookings
  // (overnight). Mirrors the food allowance shape so the UI can treat
  // the two identically.
  let stayAllowance = 0;
  const stayCfg = pricing.stayAllowance;
  const stayThresholdHours = stayCfg?.thresholdHours || 0;
  const stayEligible =
    !!stayCfg?.enabled &&
    bookedHours != null &&
    stayThresholdHours > 0 &&
    Number(bookedHours) >= stayThresholdHours;
  const stayOptedOut = stayCfg?.userOptOut && stayProvided === true;
  if (stayEligible && !stayOptedOut) {
    stayAllowance = stayCfg.amount || 0;
  }

  const toll = pricing.tollParkingEnabled ? Math.max(0, tollParking || 0) : 0;

  const subtotal =
    packagePrice +
    extraHourCharge +
    waitingCharge +
    nightCharge +
    foodAllowance +
    stayAllowance +
    toll;
  const layers = applyPlatformLayers(subtotal, pricing, subscription);

  return {
    serviceType: SERVICE_TYPES.HOURLY,
    isCustomDuration: !!isCustomDuration,
    bookedHours: bookedHours || 0,
    packagePrice: round2(packagePrice),
    extraHours,
    extraHourCharge: round2(extraHourCharge),
    waitingMinutes: waitingMinutes || 0,
    waitingCharge: round2(waitingCharge),
    nightCharge: round2(nightCharge),
    nightChargeTriggered,
    nightChargeThresholdHours: pricing.nightCharge?.thresholdHours || 0,
    foodAllowance: round2(foodAllowance),
    foodThresholdHours,
    foodEligible,
    /**
     * Notice flag for the customer UI: "your booking is long enough
     * that the driver needs a meal — please arrange food yourself".
     * No charge is added to the fare when this is true.
     */
    foodRequired,
    foodProvided: true,
    foodOptOutAvailable: false,
    stayAllowance: round2(stayAllowance),
    stayThresholdHours,
    stayEligible,
    stayProvided: !!stayProvided,
    stayOptOutAvailable: !!(stayCfg?.userOptOut && stayEligible),
    tollParking: round2(toll),
    subtotal: round2(subtotal),
    ...layers,
  };
}

// ─── OUTSTATION fare ──────────────────────────────────────────────────────────

export function calculateOutstationFare({
  pricing,
  days = 1,
  actualKm = 0,
  foodProvided = true,
  stayProvided = true,
  tollParking = 0,
  subscription = null,
} = {}) {
  if (!pricing) throw new ApiError(400, 'Service pricing is required for fare calculation');
  const o = pricing.outstation || {};

  const tripDays = Math.max(1, Math.ceil(days));
  const nights = Math.max(0, tripDays - 1);

  const dailyRateTotal = (o.dailyRate || 0) * tripDays;

  // Extra km (only when kmIncludedPerDay > 0)
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

/**
 * Universal estimate — branches on serviceType.
 */
export const estimateFareService = async ({
  serviceType,
  // hourly fields
  slabId,
  bookedHours,
  waitingMinutes = 0,
  // outstation fields
  days,
  actualKm = 0,
  stayProvided = true,
  // shared fields
  scheduledAt,
  tollParking = 0,
  foodProvided = true,
  userId = null,
}) => {
  const pricing = await getServicePricingByTypeService(serviceType);
  if (!pricing || !pricing.isActive) {
    throw new ApiError(404, 'Pricing for this service type is not available');
  }

  const subscription = userId ? await getActiveUserSubscriptionService(userId) : null;
  // Outstation only checks the start; hourly checks the whole booked
  // window so a 6-hour ride that starts at 18:00 still triggers night.
  const isNight =
    serviceType === SERVICE_TYPES.HOURLY
      ? rideCoversNightWindow(
          scheduledAt || new Date(),
          Number(bookedHours) || 0,
          pricing.nightCharge,
        )
      : isNightRideAt(scheduledAt || new Date(), pricing.nightCharge);

  if (serviceType === SERVICE_TYPES.HOURLY) {
    let slab = null;
    let isCustom = false;
    if (slabId) {
      slab = pricing.slabs.id(slabId);
      if (!slab) throw new ApiError(400, 'Selected slab not found in pricing config');
    } else if (bookedHours != null) {
      // No slab chosen — try to fit a slab first, otherwise fall back to the
      // custom-hours rate if enabled.
      const fitted = findSlabForDuration(pricing.slabs, bookedHours);
      const maxSlabHours = (pricing.slabs || []).reduce(
        (max, s) => Math.max(max, s.maxHours || 0),
        0,
      );
      if (pricing.customHours?.enabled && bookedHours > maxSlabHours) {
        isCustom = true;
      } else {
        slab = fitted;
      }
    }

    if (isCustom) {
      if (!pricing.customHours?.enabled) {
        throw new ApiError(400, 'Custom-duration bookings are disabled for this service');
      }
      const maxCustom = pricing.customHours.maxHours || 0;
      if (maxCustom > 0 && bookedHours > maxCustom) {
        throw new ApiError(400, `Custom duration cannot exceed ${maxCustom} hours`);
      }
      if (!pricing.customHours.ratePerHour || pricing.customHours.ratePerHour <= 0) {
        throw new ApiError(400, 'Custom hourly rate is not configured');
      }
    }

    const breakdown = calculateHourlyFare({
      pricing,
      slab,
      isCustomDuration: isCustom,
      bookedHours: bookedHours ?? slab?.maxHours ?? null,
      isNightRide: isNight,
      waitingMinutes,
      tollParking,
      foodProvided,
      stayProvided,
      subscription,
    });

    const waitingBuffer = buildWaitingBufferPreview(pricing);

    return {
      pricingId: pricing._id,
      serviceType: pricing.serviceType,
      serviceName: pricing.name,
      waitingBuffer,
      selectedSlab: slab
        ? {
            _id: slab._id,
            label: slab.label,
            minHours: slab.minHours,
            maxHours: slab.maxHours,
            price: slab.price,
          }
        : null,
      customHours: pricing.customHours?.enabled
        ? {
            enabled: true,
            maxHours: pricing.customHours.maxHours || 0,
            ratePerHour: pricing.customHours.ratePerHour || 0,
            label: pricing.customHours.label || 'Custom duration',
          }
        : { enabled: false },
      isCustomDuration: isCustom,
      isNightRide: isNight,
      // Surface the admin extras config so the FE can decide whether to
      // render the food / stay toggles without re-fetching the pricing
      // doc separately.
      extrasConfig: {
        foodAllowance: {
          enabled: !!pricing.foodAllowance?.enabled,
          // Amount is intentionally 0 for hourly — we no longer
          // charge a food allowance, only display the "please provide
          // driver's food" notice when threshold is crossed.
          amount: 0,
          thresholdHours: pricing.foodAllowance?.thresholdHours || 0,
          userOptOut: false,
        },
        stayAllowance: {
          enabled: !!pricing.stayAllowance?.enabled,
          amount: pricing.stayAllowance?.amount || 0,
          thresholdHours: pricing.stayAllowance?.thresholdHours || 0,
          userOptOut: !!pricing.stayAllowance?.userOptOut,
        },
        nightCharge: {
          enabled: !!pricing.nightCharge?.enabled,
          startTime: pricing.nightCharge?.startTime || '22:00',
          endTime: pricing.nightCharge?.endTime || '06:00',
          type: pricing.nightCharge?.type || 'flat',
          amount: pricing.nightCharge?.amount || 0,
          thresholdHours: pricing.nightCharge?.thresholdHours || 0,
        },
      },
      fareBreakdown: breakdown,
      subscription: serializeSubscriptionForResponse(subscription),
    };
  }

  if (serviceType === SERVICE_TYPES.OUTSTATION) {
    if (!days || days < 1) {
      throw new ApiError(400, 'Outstation: days must be at least 1');
    }

    const breakdown = calculateOutstationFare({
      pricing,
      days,
      actualKm,
      foodProvided,
      stayProvided,
      tollParking,
      subscription,
    });

    return {
      pricingId: pricing._id,
      serviceType: pricing.serviceType,
      serviceName: pricing.name,
      waitingBuffer: buildWaitingBufferPreview(pricing),
      isNightRide: isNight,
      fareBreakdown: breakdown,
      subscription: serializeSubscriptionForResponse(subscription),
    };
  }

  throw new ApiError(400, 'Unknown service type');
};

/**
 * Compact preview of the waiting-buffer policy for the customer UI.
 * Surfaces what we'll pre-collect at booking creation, why, and how
 * the unused portion is refunded — used by `FareCard` to render the
 * "Waiting buffer (refundable)" line.
 */
function buildWaitingBufferPreview(pricing) {
  const wc = pricing?.waitingCharge || {};
  const perMin = Math.max(0, Number(wc.chargePerMinute) || 0);
  const maxBillable = Math.max(0, Number(wc.maxBillableMinutes) || 0);
  return {
    bufferRupees: round2(maxBillable * perMin),
    freeWaitingMinutes: Math.max(0, Number(wc.freeWaitingMinutes) || 0),
    chargePerMinute: perMin,
    maxBillableMinutes: maxBillable,
    maxNoShowPrompts: Math.max(0, Number(wc.maxNoShowPrompts) || 0),
    noShowPromptMinutes: Math.max(0, Number(wc.noShowPromptMinutes) || 0),
    noShowGraceMinutes: Math.max(0, Number(wc.noShowGraceMinutes) || 0),
  };
}

function serializeSubscriptionForResponse(subscription) {
  if (!subscription) return null;
  return {
    _id: subscription._id,
    bookingDiscountType: subscription.bookingDiscountType,
    bookingDiscountValue: subscription.bookingDiscountValue,
    includedHoursPerDay: subscription.includedHoursPerDay,
    expiryDate: subscription.expiryDate,
    assignedDriverId: subscription.assignedDriverId?._id || subscription.assignedDriverId || null,
    assignmentStatus: subscription.assignmentStatus,
  };
}

// ─── Admin: assign / release a dedicated driver to a subscription ─────────────

export const assignDriverToSubscriptionService = async (subscriptionId, driverId, staffId) => {
  const sub = await UserSubscription.findById(subscriptionId);
  if (!sub) throw new ApiError(404, 'Subscription not found');
  if (sub.status !== SUBSCRIPTION_STATUS.ACTIVE) {
    throw new ApiError(400, 'Cannot assign a driver to an inactive subscription');
  }

  if (sub.assignedDriverId) {
    sub.previousAssignments.push({
      driverId: sub.assignedDriverId,
      assignedAt: sub.assignedAt,
      releasedAt: new Date(),
      releaseReason: 'reassigned by admin',
    });
  }

  sub.assignedDriverId = driverId;
  sub.assignedAt = new Date();
  sub.assignedBy = staffId || null;
  sub.assignmentStatus = 'assigned';
  sub.releasedAt = null;
  sub.releaseReason = '';
  await sub.save();
  return sub;
};

export const releaseSubscriptionDriverService = async (subscriptionId, reason = '') => {
  const sub = await UserSubscription.findById(subscriptionId);
  if (!sub) throw new ApiError(404, 'Subscription not found');
  if (!sub.assignedDriverId) {
    throw new ApiError(400, 'No driver is currently assigned to this subscription');
  }
  sub.previousAssignments.push({
    driverId: sub.assignedDriverId,
    assignedAt: sub.assignedAt,
    releasedAt: new Date(),
    releaseReason: reason || 'released by admin',
  });
  sub.assignedDriverId = null;
  sub.assignedAt = null;
  sub.assignmentStatus = 'released';
  sub.releasedAt = new Date();
  sub.releaseReason = reason || '';
  await sub.save();
  return sub;
};

export const listUserSubscriptionsService = async ({ status, assignmentStatus, page = 1, limit = 25 } = {}) => {
  const filter = {};
  if (status) filter.status = status;
  if (assignmentStatus) filter.assignmentStatus = assignmentStatus;
  const skip = (Math.max(1, page) - 1) * limit;
  const [items, total] = await Promise.all([
    UserSubscription.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('userId', 'name phone_no email')
      .populate('planId', 'name durationMonths')
      .populate('assignedDriverId', 'name phone rating profilePicture'),
    UserSubscription.countDocuments(filter),
  ]);
  return { items, total, page, limit };
};
