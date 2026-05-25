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
  if (serviceType === SERVICE_TYPES.HOURLY) {
    validateSlabs(data.slabs);
    validateCustomHours(data.customHours);
    validateHourlyFoodAllowance(data.foodAllowance);
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
  if (!cfg.amount || cfg.amount < 0) {
    throw new ApiError(400, 'Food allowance: amount must be greater than 0');
  }
  if (cfg.thresholdHours == null || cfg.thresholdHours < 0) {
    throw new ApiError(400, 'Food allowance: thresholdHours must be 0 or more');
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

  let nightCharge = 0;
  if (isNightRide && pricing.nightCharge?.enabled) {
    nightCharge =
      pricing.nightCharge.type === 'percentage'
        ? (packagePrice * (pricing.nightCharge.amount || 0)) / 100
        : pricing.nightCharge.amount || 0;
  }

  // Food allowance kicks in once the booked duration crosses the admin
  // threshold (e.g. >4h ride needs a meal break). Single flat amount per
  // booking — not per hour.
  let foodAllowance = 0;
  const foodCfg = pricing.foodAllowance;
  if (foodCfg?.enabled && bookedHours != null) {
    const threshold = foodCfg.thresholdHours || 0;
    if (threshold > 0 && bookedHours >= threshold) {
      foodAllowance = foodCfg.amount || 0;
    }
  }

  const toll = pricing.tollParkingEnabled ? Math.max(0, tollParking || 0) : 0;

  const subtotal =
    packagePrice + extraHourCharge + waitingCharge + nightCharge + foodAllowance + toll;
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
    foodAllowance: round2(foodAllowance),
    foodThresholdHours: foodCfg?.thresholdHours || 0,
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
  const isNight = isNightRideAt(scheduledAt || new Date(), pricing.nightCharge);

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
      subscription,
    });

    return {
      pricingId: pricing._id,
      serviceType: pricing.serviceType,
      serviceName: pricing.name,
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
      isNightRide: isNight,
      fareBreakdown: breakdown,
      subscription: serializeSubscriptionForResponse(subscription),
    };
  }

  throw new ApiError(400, 'Unknown service type');
};

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
