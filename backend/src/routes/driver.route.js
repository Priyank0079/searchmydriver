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
} from '../controllers/driver.controller.js';
import { protectDriver } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/auth/send-otp', sendOtp);
router.post('/auth/verify-otp', verifyOtpAndRegister);
router.post('/auth/login', loginDriver);

router.put('/onboarding/step', protectDriver, updateOnboardingStep);
router.get('/training', protectDriver, getTraining);
router.put('/training/progress', protectDriver, updateTrainingProgress);
router.post('/onboarding/submit', protectDriver, submitApplication);
router.get('/profile', protectDriver, getProfile);

export default router;
