import express from 'express';
import { 
  loginAdmin,
  getCustomers,
  getDrivers,
  getDriverById,
  updateDriverStatus,
  suspendDriver,
  unsuspendDriver,
  addAdminMember, 
  getAdminTeam,
  updateAdminMember,
  deleteAdminMember
} from '../controllers/admin.controller.js';
import { protectStaff, restrictTo } from '../middlewares/authMiddleware.js';
import { USER_ROLES } from '../constants/roles.js';
import { 
  createCarType, 
  updateCarType, 
  deleteCarType, 
  createCondition,
  updateCondition,
  deleteCondition,
  createTrainingVideo,
  getTrainingVideos,
  updateTrainingVideo,
  deleteTrainingVideo,
} from '../controllers/platform.controller.js';
import {
  createKit,
  getKits,
  getKitById,
  updateKit,
  deleteKit,
} from '../controllers/kit.controller.js';
import {
  getAdminKitOrders,
  getAdminKitOrderById,
  approveKitOrder,
  rejectKitOrder,
  dispatchKitOrder,
  deliverKitOrder,
} from '../controllers/kitOrder.controller.js';

const router = express.Router();

router.post('/auth/login', loginAdmin);

router.get('/users', protectStaff, restrictTo(USER_ROLES.ADMIN, USER_ROLES.TEAM_MEMBER), getCustomers);
router.get('/drivers', protectStaff, restrictTo(USER_ROLES.ADMIN, USER_ROLES.TEAM_MEMBER), getDrivers);
router.get('/drivers/:id', protectStaff, restrictTo(USER_ROLES.ADMIN, USER_ROLES.TEAM_MEMBER), getDriverById);
router.put('/drivers/:id/status', protectStaff, restrictTo(USER_ROLES.ADMIN, USER_ROLES.TEAM_MEMBER), updateDriverStatus);
router.patch('/drivers/:id/suspend', protectStaff, restrictTo(USER_ROLES.ADMIN, USER_ROLES.TEAM_MEMBER), suspendDriver);
router.patch('/drivers/:id/unsuspend', protectStaff, restrictTo(USER_ROLES.ADMIN, USER_ROLES.TEAM_MEMBER), unsuspendDriver);

router.post('/team', protectStaff, restrictTo(USER_ROLES.ADMIN), addAdminMember);
router.get('/team', protectStaff, restrictTo(USER_ROLES.ADMIN), getAdminTeam);
router.put('/team/:id', protectStaff, restrictTo(USER_ROLES.ADMIN), updateAdminMember);
router.delete('/team/:id', protectStaff, restrictTo(USER_ROLES.ADMIN), deleteAdminMember);

// Platform Settings (Admin Only)
router.post('/settings/car-types', protectStaff, restrictTo(USER_ROLES.ADMIN), createCarType);
router.put('/settings/car-types/:id', protectStaff, restrictTo(USER_ROLES.ADMIN), updateCarType);
router.delete('/settings/car-types/:id', protectStaff, restrictTo(USER_ROLES.ADMIN), deleteCarType);

router.post('/settings/conditions', protectStaff, restrictTo(USER_ROLES.ADMIN), createCondition);
router.put('/settings/conditions/:id', protectStaff, restrictTo(USER_ROLES.ADMIN), updateCondition);
router.delete('/settings/conditions/:id', protectStaff, restrictTo(USER_ROLES.ADMIN), deleteCondition);

router.post('/settings/training-videos', protectStaff, restrictTo(USER_ROLES.ADMIN), createTrainingVideo);
router.get('/settings/training-videos', protectStaff, restrictTo(USER_ROLES.ADMIN, USER_ROLES.TEAM_MEMBER), getTrainingVideos);
router.put('/settings/training-videos/:id', protectStaff, restrictTo(USER_ROLES.ADMIN), updateTrainingVideo);
router.delete('/settings/training-videos/:id', protectStaff, restrictTo(USER_ROLES.ADMIN), deleteTrainingVideo);

// Driver kits
router.post('/kits', protectStaff, restrictTo(USER_ROLES.ADMIN), createKit);
router.get('/kits', protectStaff, restrictTo(USER_ROLES.ADMIN, USER_ROLES.TEAM_MEMBER), getKits);
router.get('/kits/:id', protectStaff, restrictTo(USER_ROLES.ADMIN, USER_ROLES.TEAM_MEMBER), getKitById);
router.put('/kits/:id', protectStaff, restrictTo(USER_ROLES.ADMIN), updateKit);
router.delete('/kits/:id', protectStaff, restrictTo(USER_ROLES.ADMIN), deleteKit);

router.get('/kit-orders', protectStaff, restrictTo(USER_ROLES.ADMIN, USER_ROLES.TEAM_MEMBER), getAdminKitOrders);
router.get('/kit-orders/:id', protectStaff, restrictTo(USER_ROLES.ADMIN, USER_ROLES.TEAM_MEMBER), getAdminKitOrderById);
router.patch('/kit-orders/:id/approve', protectStaff, restrictTo(USER_ROLES.ADMIN, USER_ROLES.TEAM_MEMBER), approveKitOrder);
router.patch('/kit-orders/:id/reject', protectStaff, restrictTo(USER_ROLES.ADMIN, USER_ROLES.TEAM_MEMBER), rejectKitOrder);
router.patch('/kit-orders/:id/dispatch', protectStaff, restrictTo(USER_ROLES.ADMIN, USER_ROLES.TEAM_MEMBER), dispatchKitOrder);
router.patch('/kit-orders/:id/deliver', protectStaff, restrictTo(USER_ROLES.ADMIN, USER_ROLES.TEAM_MEMBER), deliverKitOrder);

export default router;
