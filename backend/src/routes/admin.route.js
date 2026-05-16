import express from 'express';
import { 
  loginAdmin,
  getCustomers,
  getDrivers, 
  updateDriverStatus, 
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
  deleteCondition 
} from '../controllers/platform.controller.js';

const router = express.Router();

router.post('/auth/login', loginAdmin);

router.get('/users', protectStaff, restrictTo(USER_ROLES.ADMIN, USER_ROLES.TEAM_MEMBER), getCustomers);
router.get('/drivers', protectStaff, restrictTo(USER_ROLES.ADMIN, USER_ROLES.TEAM_MEMBER), getDrivers);
router.put('/drivers/:id/status', protectStaff, restrictTo(USER_ROLES.ADMIN, USER_ROLES.TEAM_MEMBER), updateDriverStatus);

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

export default router;
