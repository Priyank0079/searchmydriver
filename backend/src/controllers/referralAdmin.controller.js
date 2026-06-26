import PlatformSettings from '../models/platformSettings.model.js';
import Referral from '../models/referral.model.js';
import WithdrawalRequest from '../models/withdrawalRequest.model.js';
import WalletTransaction, { WALLET_TXN_DIRECTION, WALLET_TXN_SOURCE } from '../models/walletTransaction.model.js';
import { Driver } from '../models/driverModels/driver.model.js';
import User from '../models/user.model.js';

// Settings (`GET/PUT /admin/referral-settings`)
export const getReferralSettings = async (req, res, next) => {
  try {
    let settings = await PlatformSettings.findOne();
    if (!settings) {
      settings = await PlatformSettings.create({});
    }
    res.status(200).json({
      status: 'success',
      data: {
        referral: settings.referral || {},
      },
    });
  } catch (err) {
    next(err);
  }
};

export const updateReferralSettings = async (req, res, next) => {
  try {
    const referral = req.body.referral || req.body;
    let settings = await PlatformSettings.findOne();
    if (!settings) {
      settings = new PlatformSettings({});
    }
    
    settings.referral = {
      user: { ...settings.referral?.user, ...referral?.user },
      driver: { ...settings.referral?.driver, ...referral?.driver },
    };
    settings.updatedBy = req.user?._id;
    await settings.save();

    res.status(200).json({
      status: 'success',
      data: {
        referral: settings.referral,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Referrals List & Approval (`GET/PUT /admin/referrals`)
export const listReferrals = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const query = {};
    if (req.query.status) query.status = req.query.status;
    if (req.query.referrerType) query.referrerType = req.query.referrerType;

    const referrals = await Referral.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('referrerId', 'name email phone_no profilePicture')
      .populate('referredId', 'name email phone_no profilePicture')
      .lean();

    const total = await Referral.countDocuments(query);

    res.status(200).json({
      status: 'success',
      data: {
        referrals,
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
};

export const approveReferral = async (req, res, next) => {
  try {
    const { id } = req.params;
    const referral = await Referral.findById(id);
    if (!referral) return res.status(404).json({ message: 'Referral not found' });
    if (referral.status !== 'pending') return res.status(400).json({ message: 'Only pending referrals can be approved' });

    referral.status = 'successful';
    referral.completedAt = new Date();
    referral.triggerEntityType = 'Admin';
    referral.triggerEntityId = req.user._id;
    await referral.save();

    // Credit wallet logic
    const Model = referral.referrerType === 'Driver' ? Driver : User;
    const referrer = await Model.findById(referral.referrerId);
    if (referrer) {
      referrer.walletBalance = (referrer.walletBalance || 0) + referral.rewardAmount;
      await referrer.save();

      await WalletTransaction.create({
        userType: referral.referrerType,
        userId: referrer._id,
        direction: WALLET_TXN_DIRECTION.CREDIT,
        amountRupees: referral.rewardAmount,
        balanceAfter: referrer.walletBalance,
        source: WALLET_TXN_SOURCE.REFERRAL_REWARD,
        description: `Referral reward for ${referral.referredType}`,
        refType: 'Referral',
        refId: referral._id,
        initiatedBy: req.user._id,
      });
    }

    res.status(200).json({ status: 'success', data: { referral } });
  } catch (err) {
    next(err);
  }
};

export const rejectReferral = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const referral = await Referral.findById(id);
    if (!referral) return res.status(404).json({ message: 'Referral not found' });
    if (referral.status !== 'pending') return res.status(400).json({ message: 'Only pending referrals can be rejected' });

    referral.status = 'rejected';
    referral.rejectionReason = reason || 'Rejected by Admin';
    referral.triggerEntityType = 'Admin';
    referral.triggerEntityId = req.user._id;
    await referral.save();

    res.status(200).json({ status: 'success', data: { referral } });
  } catch (err) {
    next(err);
  }
};

// Withdrawals (`GET/PUT /admin/withdrawals`)
export const listWithdrawals = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const query = {};
    if (req.query.status) query.status = req.query.status;

    const withdrawals = await WithdrawalRequest.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('driverId', 'name email phone_no profilePicture')
      .lean();

    const total = await WithdrawalRequest.countDocuments(query);

    res.status(200).json({
      status: 'success',
      data: {
        withdrawals,
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
};

export const approveWithdrawal = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { transactionRef } = req.body;
    const withdrawal = await WithdrawalRequest.findById(id);
    
    if (!withdrawal) return res.status(404).json({ message: 'Withdrawal not found' });
    if (withdrawal.status !== 'pending') return res.status(400).json({ message: 'Only pending withdrawals can be approved' });

    withdrawal.status = 'approved';
    withdrawal.transactionRef = transactionRef || '';
    withdrawal.adminId = req.user._id;
    withdrawal.processedAt = new Date();
    await withdrawal.save();

    res.status(200).json({ status: 'success', data: { withdrawal } });
  } catch (err) {
    next(err);
  }
};

export const rejectWithdrawal = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const withdrawal = await WithdrawalRequest.findById(id);
    
    if (!withdrawal) return res.status(404).json({ message: 'Withdrawal not found' });
    if (withdrawal.status !== 'pending') return res.status(400).json({ message: 'Only pending withdrawals can be rejected' });

    withdrawal.status = 'rejected';
    withdrawal.rejectionReason = reason || 'Rejected by Admin';
    withdrawal.adminId = req.user._id;
    withdrawal.processedAt = new Date();
    await withdrawal.save();

    // Refund the driver
    const driver = await Driver.findById(withdrawal.driverId);
    if (driver) {
      driver.walletBalance = (driver.walletBalance || 0) + withdrawal.amount;
      await driver.save();

      await WalletTransaction.create({
        userType: 'Driver',
        userId: driver._id,
        direction: WALLET_TXN_DIRECTION.CREDIT,
        amountRupees: withdrawal.amount,
        balanceAfter: driver.walletBalance,
        source: WALLET_TXN_SOURCE.WITHDRAWAL_REJECTED,
        description: `Withdrawal rejected: ${reason || 'Admin action'}`,
        refType: 'WithdrawalRequest',
        refId: withdrawal._id,
        initiatedBy: req.user._id,
      });
    }

    res.status(200).json({ status: 'success', data: { withdrawal } });
  } catch (err) {
    next(err);
  }
};
