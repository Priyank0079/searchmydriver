import express from 'express';
import {
  sendOtp,
  verifyOtpAndRegister,
  loginDriver,
  updateOnboardingStep,
  submitApplication,
  getProfile,
} from '../controllers/driver.controller.js';
import { protectDriver } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/auth/send-otp', sendOtp);
router.post('/auth/verify-otp', verifyOtpAndRegister);
router.post('/auth/login', loginDriver);

router.put('/onboarding/step', protectDriver, updateOnboardingStep);
router.post('/onboarding/submit', protectDriver, submitApplication);
router.get('/profile', protectDriver, getProfile);

export default router;
