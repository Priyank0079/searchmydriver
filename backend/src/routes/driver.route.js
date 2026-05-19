import express from 'express';
import {
  sendOtp,
  verifyOtpAndRegister,
  loginDriver,
  updateOnboardingStep,
  submitApplication,
  getProfile,
  getTraining,
  updateTrainingProgress,
  uploadLiveVerification,
  reopenRejectedApplication,
} from '../controllers/driver.controller.js';
import { uploadVideo as uploadVideoMiddleware } from '../middlewares/multer.js';
import {
  googleSignInDriver,
  linkGoogleDriverPhone,
} from '../controllers/googleAuth.controller.js';
import { protectDriver } from '../middlewares/authMiddleware.js';
import { getMandatoryKit, getAvailableKits } from '../controllers/kit.controller.js';
import {
  createKitOrder,
  getMyKitOrders,
  getMyActiveKitOrder,
  retryKitOrderPayment,
  markKitOrderPaymentFailed,
} from '../controllers/kitOrder.controller.js';
import { verifyKitPayment } from '../controllers/payment.controller.js';
import { getOnlineStatus, setOnlineStatus } from '../controllers/driverOnline.controller.js';
import {
  getMyOrders,
  getMyOrderById,
  getMyPaymentHistory,
} from '../controllers/driverHistory.controller.js';

const router = express.Router();

router.post('/auth/send-otp', sendOtp);
router.post('/auth/verify-otp', verifyOtpAndRegister);
router.post('/auth/login', loginDriver);
router.post('/auth/google', googleSignInDriver);

router.put('/onboarding/step', protectDriver, updateOnboardingStep);
router.post(
  '/onboarding/live-verification',
  protectDriver,
  uploadVideoMiddleware.single('video'),
  uploadLiveVerification,
);
router.post('/auth/google/link-phone', protectDriver, linkGoogleDriverPhone);
router.get('/training', protectDriver, getTraining);
router.put('/training/progress', protectDriver, updateTrainingProgress);
router.post('/onboarding/submit', protectDriver, submitApplication);
router.post('/application/reopen', protectDriver, reopenRejectedApplication);
router.get('/profile', protectDriver, getProfile);

router.get('/kits', protectDriver, getAvailableKits);
router.get('/kits/mandatory', protectDriver, getMandatoryKit);
router.get('/kit-orders', protectDriver, getMyKitOrders);
router.get('/kit-orders/active', protectDriver, getMyActiveKitOrder);
router.post('/kit-orders', protectDriver, createKitOrder);
router.post('/kit-orders/:id/pay', protectDriver, retryKitOrderPayment);
router.post('/kit-orders/:id/payment-failed', protectDriver, markKitOrderPaymentFailed);
router.get('/orders', protectDriver, getMyOrders);
router.get('/orders/:id', protectDriver, getMyOrderById);
router.get('/payments/history', protectDriver, getMyPaymentHistory);
router.post('/payments/verify', protectDriver, verifyKitPayment);

router.get('/online/status', protectDriver, getOnlineStatus);
router.put('/online', protectDriver, setOnlineStatus);

export default router;
