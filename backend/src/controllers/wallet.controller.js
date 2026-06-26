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

import WithdrawalRequest from '../models/withdrawalRequest.model.js';
import WalletTransaction, { WALLET_TXN_DIRECTION, WALLET_TXN_SOURCE } from '../models/walletTransaction.model.js';
import { Driver } from '../models/driverModels/driver.model.js';

export const requestWithdrawal = asyncHandler(async (req, res) => {
  const driverId = req.driver._id;
  const { amount, payoutMethod, payoutDetails } = req.body;

  if (!amount || amount <= 0 || !payoutMethod || !payoutDetails) {
    return res.status(400).json(new ApiResponse(400, null, 'Invalid withdrawal request details'));
  }

  const driver = await Driver.findById(driverId);
  if (!driver || (driver.walletBalance || 0) < amount) {
    return res.status(400).json(new ApiResponse(400, null, 'Insufficient wallet balance'));
  }

  // Deduct immediately, if rejected admin will refund
  driver.walletBalance -= amount;
  await driver.save();

  const withdrawal = await WithdrawalRequest.create({
    driverId,
    amount,
    payoutMethod,
    payoutDetails,
    status: 'pending',
  });

  await WalletTransaction.create({
    userType: 'Driver',
    userId: driverId,
    direction: WALLET_TXN_DIRECTION.DEBIT,
    amountRupees: amount,
    balanceAfter: driver.walletBalance,
    source: WALLET_TXN_SOURCE.WITHDRAWAL,
    description: `Withdrawal request via ${payoutMethod}`,
    refType: 'WithdrawalRequest',
    refId: withdrawal._id,
  });

  return res.status(201).json(new ApiResponse(201, { withdrawal }, 'Withdrawal request submitted successfully'));
});
