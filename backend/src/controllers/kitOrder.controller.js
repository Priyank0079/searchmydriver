import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/apiResponse.js';
import * as kitOrderService from '../services/kitOrder.service.js';

export const createKitOrder = asyncHandler(async (req, res) => {
  const result = await kitOrderService.createKitOrderService(req.driver._id, req.body);
  return res.status(201).json(new ApiResponse(201, result, 'Kit order created'));
});

export const getMyKitOrders = asyncHandler(async (req, res) => {
  const result = await kitOrderService.getDriverKitOrdersService(req.driver._id);
  return res.status(200).json(new ApiResponse(200, result, 'Kit orders fetched'));
});

export const getMyActiveKitOrder = asyncHandler(async (req, res) => {
  const result = await kitOrderService.getDriverActiveKitOrderService(req.driver._id);
  return res.status(200).json(new ApiResponse(200, result, 'Kit status fetched'));
});

export const retryKitOrderPayment = asyncHandler(async (req, res) => {
  const result = await kitOrderService.retryKitOrderPaymentService(
    req.driver._id,
    req.params.id,
  );
  return res.status(200).json(new ApiResponse(200, result, 'Payment session ready'));
});

export const markKitOrderPaymentFailed = asyncHandler(async (req, res) => {
  const result = await kitOrderService.markKitOrderPaymentFailedService(
    req.driver._id,
    req.params.id,
    req.body?.note,
  );
  return res.status(200).json(new ApiResponse(200, result, 'Order updated'));
});

export const getAdminKitOrders = asyncHandler(async (req, res) => {
  const result = await kitOrderService.getAdminKitOrdersService(req.staff, req.query);
  return res.status(200).json(new ApiResponse(200, result, 'Kit orders fetched'));
});

export const getAdminKitOrderById = asyncHandler(async (req, res) => {
  const result = await kitOrderService.getAdminKitOrderByIdService(req.staff, req.params.id);
  return res.status(200).json(new ApiResponse(200, result, 'Kit order fetched'));
});

export const approveKitOrder = asyncHandler(async (req, res) => {
  const result = await kitOrderService.approveKitOrderService(
    req.staff,
    req.params.id,
    req.body.note,
  );
  return res.status(200).json(new ApiResponse(200, result, 'Kit order approved'));
});

export const rejectKitOrder = asyncHandler(async (req, res) => {
  const result = await kitOrderService.rejectKitOrderService(
    req.staff,
    req.params.id,
    req.body.note,
  );
  return res.status(200).json(new ApiResponse(200, result, 'Kit order rejected'));
});

export const dispatchKitOrder = asyncHandler(async (req, res) => {
  const result = await kitOrderService.dispatchKitOrderService(
    req.staff._id,
    req.params.id,
    req.body,
  );
  return res.status(200).json(new ApiResponse(200, result, 'Kit order dispatched'));
});

export const deliverKitOrder = asyncHandler(async (req, res) => {
  const result = await kitOrderService.markKitOrderDeliveredService(req.staff._id, req.params.id);
  return res.status(200).json(new ApiResponse(200, result, 'Kit order marked delivered'));
});
