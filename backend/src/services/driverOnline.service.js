import { Driver } from '../models/driverModels/driver.model.js';
import { ApiError } from '../utils/apiError.js';
import { getDriverKitEligibility, syncDriverKitEligibility } from '../utils/kitEligibility.util.js';

export const getOnlineStatusService = async (driverId) => {
  const driver = await Driver.findById(driverId).select('isOnline isOnTrip approvalStatus canGoOnline');
  if (!driver) throw new ApiError(404, 'Driver not found');

  const eligibility = await getDriverKitEligibility(driverId);

  return {
    isOnline: driver.isOnline,
    isOnTrip: driver.isOnTrip,
    canGoOnline: eligibility.allowed,
    reasons: eligibility.reasons,
    code: eligibility.code,
    activeOrder: eligibility.activeOrder,
  };
};

export const setDriverOnlineService = async (driverId, online) => {
  const driver = await Driver.findById(driverId);
  if (!driver) throw new ApiError(404, 'Driver not found');

  if (!online) {
    driver.isOnline = false;
    await driver.save();
    return { isOnline: false, canGoOnline: driver.canGoOnline };
  }

  const eligibility = await getDriverKitEligibility(driverId);

  if (!eligibility.allowed) {
    throw new ApiError(403, eligibility.reasons[0] || 'Cannot go online', {
      code: eligibility.code,
      reasons: eligibility.reasons,
      activeOrder: eligibility.activeOrder,
    });
  }

  driver.isOnline = true;
  driver.lastOnlineAt = new Date();
  driver.canGoOnline = true;
  await driver.save();

  return {
    isOnline: true,
    canGoOnline: true,
    lastOnlineAt: driver.lastOnlineAt,
  };
};

export const refreshDriverEligibilityService = async (driverId) => {
  return syncDriverKitEligibility(driverId);
};
