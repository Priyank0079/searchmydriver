import express from 'express';
import { refreshAccessToken, logout } from '../controllers/common.controller.js';
import { 
  loginUser, 
  sendUserOtp, 
  verifyUserOtpAndRegister, 
  updateUserOnboardingStep,
  getUserProfile,
  getRegistrationStatus,
  addCar,
  getUserCars,
  deleteUserCar
} from '../controllers/user.controller.js';
import { protectUser, protectProfileViewer } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Auth Public
router.post('/send-otp', sendUserOtp);
router.post('/verify-otp', verifyUserOtpAndRegister);
router.post('/login', loginUser);
router.post('/refresh-token', refreshAccessToken);
router.post('/logout', logout);

// Profile — customer (own id) or staff (any customer id)
router.get('/users/:userId/profile', protectProfileViewer, getUserProfile);

// Protected Onboarding & Cars
router.use(protectUser);
router.get('/onboarding/status', getRegistrationStatus);
router.put('/onboarding/step', updateUserOnboardingStep);

// Cars management
router.post('/cars', addCar);
router.get('/cars', getUserCars);
router.delete('/cars/:id', deleteUserCar);

export default router;
