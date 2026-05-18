import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { setAuthCookies } from '../utils/cookie.util.js';
import * as adminService from '../services/admin.service.js';

export const loginAdmin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await adminService.loginStaffService(email, password);

  setAuthCookies(res, {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
  });

  return res.status(200).json(new ApiResponse(200, { admin: result.admin }, 'Staff login successful'));
});

export const getCustomers = asyncHandler(async (req, res) => {
  const result = await adminService.getCustomersService(req.query);
  return res.status(200).json(new ApiResponse(200, result, 'Users fetched successfully'));
});

export const getDrivers = asyncHandler(async (req, res) => {
  const result = await adminService.getDriversService(req.query);
  return res.status(200).json(new ApiResponse(200, result, "Drivers fetched successfully"));
});

export const getDriverById = asyncHandler(async (req, res) => {
  const result = await adminService.getDriverByIdService(req.params.id);
  return res.status(200).json(new ApiResponse(200, result, 'Driver profile fetched successfully'));
});

export const updateDriverStatus = asyncHandler(async (req, res) => {
  const result = await adminService.updateDriverStatusService(req.staff._id, req.params.id, req.body);
  return res.status(200).json(new ApiResponse(200, result, `Driver status updated successfully`));
});

export const suspendDriver = asyncHandler(async (req, res) => {
  const result = await adminService.suspendDriverService(req.staff._id, req.params.id, req.body);
  return res.status(200).json(new ApiResponse(200, result, 'Driver suspended successfully'));
});

export const unsuspendDriver = asyncHandler(async (req, res) => {
  const result = await adminService.unsuspendDriverService(req.staff._id, req.params.id);
  return res.status(200).json(new ApiResponse(200, result, 'Driver unsuspended successfully'));
});

export const addAdminMember = asyncHandler(async (req, res) => {
  const result = await adminService.addAdminMemberService(req.body);
  return res.status(201).json(new ApiResponse(201, result, "Admin team member added successfully"));
});

export const getAdminTeam = asyncHandler(async (req, res) => {
  const result = await adminService.getAdminTeamService(req.query);
  return res.status(200).json(new ApiResponse(200, result, "Admin team fetched successfully"));
});

export const updateAdminMember = asyncHandler(async (req, res) => {
  const result = await adminService.updateAdminMemberService(req.params.id, req.body);
  return res.status(200).json(new ApiResponse(200, result, "Admin team member updated successfully"));
});

export const deleteAdminMember = asyncHandler(async (req, res) => {
  const result = await adminService.deleteAdminMemberService(req.params.id);
  return res.status(200).json(new ApiResponse(200, result, "Admin team member removed successfully"));
});
