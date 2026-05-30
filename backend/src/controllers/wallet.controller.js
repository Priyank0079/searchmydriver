import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/apiResponse.js';
import {
  getWalletService,
  listWalletTransactionsService,
  createTopupOrderService,
  verifyTopupPaymentService,
  WALLET_LIMITS,
} from '../services/wallet.service.js';

/**
 * User-facing wallet endpoints.
 *
 *   GET    /auth/wallet                 → current balance + lifetime totals
 *   GET    /auth/wallet/transactions    → paginated ledger
 *   POST   /auth/wallet/topup           → start a Razorpay top-up order
 *   POST   /auth/wallet/topup/verify    → confirm Razorpay payment → credit
 */

export const getMyWallet = asyncHandler(async (req, res) => {
  const wallet = await getWalletService(req.user._id);
  return res
    .status(200)
    .json(new ApiResponse(200, { wallet, limits: WALLET_LIMITS }, 'Wallet fetched'));
});

export const getMyWalletTransactions = asyncHandler(async (req, res) => {
  const result = await listWalletTransactionsService(req.user._id, {
    page: req.query.page,
    limit: req.query.limit,
  });
  return res
    .status(200)
    .json(new ApiResponse(200, result, 'Wallet transactions fetched'));
});

export const createWalletTopupOrder = asyncHandler(async (req, res) => {
  const order = await createTopupOrderService(req.user._id, req.body?.amount);
  return res
    .status(201)
    .json(new ApiResponse(201, { razorpay: order }, 'Top-up order created'));
});

export const verifyWalletTopupPayment = asyncHandler(async (req, res) => {
  const result = await verifyTopupPaymentService(req.user._id, req.body || {});
  return res
    .status(200)
    .json(new ApiResponse(200, result, 'Top-up successful'));
});
