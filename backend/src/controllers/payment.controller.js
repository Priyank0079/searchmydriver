import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/apiResponse.js';
import * as paymentService from '../services/payment.service.js';
import { verifyRazorpayWebhookSignature } from '../utils/razorpay.js';

export const verifyKitPayment = asyncHandler(async (req, res) => {
  const result = await paymentService.verifyKitPaymentService(req.driver._id, req.body);
  return res.status(200).json(new ApiResponse(200, result, 'Payment verified'));
});

export const razorpayWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const rawBody = req.rawBody || JSON.stringify(req.body);

  if (!verifyRazorpayWebhookSignature(rawBody, signature)) {
    return res.status(400).json({ status: 400, message: 'Invalid webhook signature' });
  }

  const event = req.body?.event;
  const payload = req.body?.payload;
  const result = await paymentService.handleRazorpayWebhookService(event, payload);

  return res.status(200).json({ status: 200, received: true, ...result });
});
