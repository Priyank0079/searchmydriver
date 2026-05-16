import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { setAuthCookies } from '../utils/cookie.util.js';
import * as driverService from '../services/driver.service.js';

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
