import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { setAuthCookies } from '../utils/cookie.util.js';
import * as userService from '../services/user.service.js';

export const sendUserOtp = asyncHandler(async (req, res) => {
  const result = await userService.sendUserOtpService(req.body.phone);
  return res.status(200).json(new ApiResponse(200, result, 'OTP sent successfully'));
});

export const verifyUserOtpAndRegister = asyncHandler(async (req, res) => {
  const result = await userService.verifyUserOtpAndRegisterService(req.body);
  setAuthCookies(res, {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
  });
  return res.status(201).json(new ApiResponse(201, { user: result.user }, 'Registration successful'));
});

export const loginUser = asyncHandler(async (req, res) => {
  const { phone, password } = req.body;
  const result = await userService.loginUserService(phone, password);
  setAuthCookies(res, {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
  });
  return res.status(200).json(new ApiResponse(200, { user: result.user }, 'Login successful'));
});

export const updateUserOnboardingStep = asyncHandler(async (req, res) => {
  const result = await userService.updateUserOnboardingStepService(req.user._id, req.body);
  return res.status(200).json(new ApiResponse(200, result, 'Onboarding step updated'));
});

export const getUserProfile = asyncHandler(async (req, res) => {
  const result = await userService.getUserProfileService(req.params.userId);
  return res.status(200).json(new ApiResponse(200, result, 'User profile fetched'));
});

export const getRegistrationStatus = asyncHandler(async (req, res) => {
  const result = await userService.getRegistrationStatusService(req.user._id);
  return res.status(200).json(new ApiResponse(200, result, 'Registration status fetched'));
});

// Car Controllers (Consolidated)
export const addCar = asyncHandler(async (req, res) => {
  const result = await userService.addCarService(req.user._id, req.body);
  return res.status(201).json(new ApiResponse(201, result, 'Car added successfully'));
});

export const getUserCars = asyncHandler(async (req, res) => {
  const cars = await userService.getUserCarsService(req.user._id);
  return res.status(200).json(new ApiResponse(200, cars, 'Cars fetched successfully'));
});

export const deleteUserCar = asyncHandler(async (req, res) => {
  await userService.deleteUserCarService(req.user._id, req.params.id);
  return res.status(200).json(new ApiResponse(200, null, 'Car deleted successfully'));
});
