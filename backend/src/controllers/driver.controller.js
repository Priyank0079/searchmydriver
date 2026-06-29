import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { setAuthCookies, clearAuthCookies } from '../utils/cookie.util.js';
import * as driverService from '../services/driver.service.js';
import { sendFcmNotification } from '../config/firebase.js';

export const sendOtp = asyncHandler(async (req, res) => {
  const result = await driverService.sendOtpService(req.body.phone);
  return res.status(200).json(new ApiResponse(200, result, 'OTP sent successfully'));
});

export const verifyOtpAndRegister = asyncHandler(async (req, res) => {
  const result = await driverService.verifyOtpAndRegisterService(req.body);

  setAuthCookies(res, {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
  });

  return res.status(200).json(new ApiResponse(200, { driver: result.driver }, 'Registration step 1 completed'));
});

export const loginDriver = asyncHandler(async (req, res) => {
  const { phone, password } = req.body;
  const result = await driverService.loginDriverService(phone, password);

  setAuthCookies(res, {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
  });

  return res.status(200).json(new ApiResponse(200, { driver: result.driver }, 'Login successful'));
});

export const updateOnboardingStep = asyncHandler(async (req, res) => {
  const result = await driverService.updateOnboardingStepService(req.driver._id, req.body);
  return res.status(200).json(new ApiResponse(200, result, `Step ${req.body.stepNumber} completed successfully`));
});

export const submitApplication = asyncHandler(async (req, res) => {
  const result = await driverService.submitApplicationService(req.driver._id);
  return res.status(200).json(new ApiResponse(200, result, "Application submitted for review"));
});

export const getProfile = asyncHandler(async (req, res) => {
  const result = await driverService.getProfileService(req.driver._id);
  return res.status(200).json(new ApiResponse(200, result, "Driver profile retrieved"));
});

export const getTraining = asyncHandler(async (req, res) => {
  const result = await driverService.getDriverTrainingService(req.driver._id);
  return res.status(200).json(new ApiResponse(200, result, 'Training modules fetched'));
});

export const updateTrainingProgress = asyncHandler(async (req, res) => {
  const result = await driverService.updateTrainingProgressService(req.driver._id, req.body);
  return res.status(200).json(new ApiResponse(200, result, 'Training progress updated'));
});

export const reopenRejectedApplication = asyncHandler(async (req, res) => {
  const result = await driverService.reopenRejectedApplicationService(req.driver._id);
  return res.status(200).json(new ApiResponse(200, result, 'Application reopened for updates'));
});

export const uploadLiveVerification = asyncHandler(async (req, res) => {
  const durationSeconds = req.body.durationSeconds;
  const result = await driverService.uploadLiveVerificationService(
    req.driver._id,
    req.file,
    durationSeconds,
  );
  return res.status(200).json(new ApiResponse(200, result, 'Live verification video saved'));
});

/**
 * Toggle the driver's outstation opt-in. Outstation bookings are
 * dispatched manually from the admin queue; only drivers with this
 * flag set will appear in the picker. Body: `{ available: boolean }`.
 */
export const updateOutstationAvailability = asyncHandler(async (req, res) => {
  const { available, zoneIds } = req.body || {};
  const result = await driverService.updateOutstationAvailabilityService(
    req.driver._id,
    {
      available: !!available,
      zoneIds: Array.isArray(zoneIds) ? zoneIds : undefined,
    },
  );
  const message = result.availableForOutstation
    ? "You're now visible for outstation assignments"
    : "You've opted out of outstation assignments";
  return res.status(200).json(new ApiResponse(200, result, message));
});

export const updateMonthlyAvailability = asyncHandler(async (req, res) => {
  const { available } = req.body || {};
  const result = await driverService.updateMonthlyAvailabilityService(
    req.driver._id,
    {
      available: !!available,
    },
  );
  const message = result.availableForMonthlyRide
    ? "You're now visible for monthly ride requests"
    : "You've opted out of monthly ride requests";
  return res.status(200).json(new ApiResponse(200, result, message));
});

export const deleteMyAccount = asyncHandler(async (req, res) => {
  const result = await driverService.deleteDriverAccountService(req.driver._id);
  clearAuthCookies(res);
  return res.status(200).json(new ApiResponse(200, result, 'Account deleted successfully'));
});

export const updateDriverFcmToken = asyncHandler(async (req, res) => {
  const { token } = req.body;
  req.driver.fcmToken = token || '';
  await req.driver.save();
  return res.status(200).json(new ApiResponse(200, null, 'FCM token updated successfully'));
});

export const triggerDriverTestPush = asyncHandler(async (req, res) => {
  if (!req.driver.fcmToken) {
    return res.status(400).json(new ApiResponse(400, null, 'No FCM token registered for this driver'));
  }
  
  const success = await sendFcmNotification(req.driver.fcmToken, {
    title: 'Test Notification',
    body: `Hello ${req.driver.name}, this is a test push notification from SearchMyDriver!`,
    data: { type: 'test', timestamp: Date.now() },
  });

  if (success) {
    return res.status(200).json(new ApiResponse(200, null, 'Test push notification sent successfully'));
  } else {
    return res.status(500).json(new ApiResponse(500, null, 'Failed to send test push notification'));
  }
});
