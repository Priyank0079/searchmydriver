import express from 'express';
import {
  loginAdmin,
  getStaffMe,
  getCustomers,
  getDrivers,
  getDriverById,
  updateDriverStatus,
  suspendDriver,
  unsuspendDriver,
  addAdminMember,
  getAdminTeam,
  updateAdminMember,
  deleteAdminMember,
} from '../controllers/admin.controller.js';
import { protectStaff, restrictTo } from '../middlewares/authMiddleware.js';
import { ROUTE_ROLES } from '../constants/staffPermissions.js';
import {
  createCarType,
  updateCarType,
  deleteCarType,
  createCondition,
  updateCondition,
  deleteCondition,
  createTrainingVideo,
  getAdminCarTypes,
  getAdminConditions,
  getAdminTrainingVideos,
  updateTrainingVideo,
  deleteTrainingVideo,
} from '../controllers/platform.controller.js';
import {
  getAdminFuelTypes,
  createFuelType,
  updateFuelType,
  deleteFuelType,
  getAdminCarBrands,
  createCarBrand,
  updateCarBrand,
  deleteCarBrand,
  getAdminCarModels,
  createCarModel,
  updateCarModel,
  deleteCarModel,
} from '../controllers/vehicleCatalog.controller.js';
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
import {
  createZone,
  listZones,
  getZoneById,
  updateZone,
  deleteZone,
} from '../controllers/zone.controller.js';
import {
  getTaskAssignees,
  getTaskSummary,
  listTasks,
  listTaskActivity,
  getTaskByResource,
  assignTasks,
  assignTask,
  claimTask,
  syncReviewTasks,
} from '../controllers/adminTask.controller.js';

const router = express.Router();
const { ALL_STAFF, OPERATIONS, SUPER_ADMIN } = ROUTE_ROLES;

router.post('/auth/login', loginAdmin);
router.get('/auth/me', protectStaff, restrictTo(...ALL_STAFF), getStaffMe);

router.get('/users', protectStaff, restrictTo(...ALL_STAFF), getCustomers);

router.get('/tasks/assignees', protectStaff, restrictTo(...OPERATIONS), getTaskAssignees);
router.get('/tasks/activity', protectStaff, restrictTo(...SUPER_ADMIN), listTaskActivity);
router.get('/tasks/summary', protectStaff, restrictTo(...ALL_STAFF), getTaskSummary);
router.get('/tasks', protectStaff, restrictTo(...ALL_STAFF), listTasks);
router.get('/tasks/by-resource', protectStaff, restrictTo(...ALL_STAFF), getTaskByResource);
router.post('/tasks/assign', protectStaff, restrictTo(...OPERATIONS), assignTasks);
router.post('/tasks/sync', protectStaff, restrictTo(...OPERATIONS), syncReviewTasks);
router.patch('/tasks/:id/assign', protectStaff, restrictTo(...OPERATIONS), assignTask);
router.post('/tasks/:id/claim', protectStaff, restrictTo(...OPERATIONS), claimTask);

router.get('/drivers', protectStaff, restrictTo(...ALL_STAFF), getDrivers);
router.get('/drivers/:id', protectStaff, restrictTo(...ALL_STAFF), getDriverById);
router.put('/drivers/:id/status', protectStaff, restrictTo(...ALL_STAFF), updateDriverStatus);
router.patch('/drivers/:id/suspend', protectStaff, restrictTo(...ALL_STAFF), suspendDriver);
router.patch('/drivers/:id/unsuspend', protectStaff, restrictTo(...ALL_STAFF), unsuspendDriver);

router.post('/team', protectStaff, restrictTo(...SUPER_ADMIN), addAdminMember);
router.get('/team', protectStaff, restrictTo(...SUPER_ADMIN), getAdminTeam);
router.put('/team/:id', protectStaff, restrictTo(...SUPER_ADMIN), updateAdminMember);
router.delete('/team/:id', protectStaff, restrictTo(...SUPER_ADMIN), deleteAdminMember);

router.get('/settings/car-types', protectStaff, restrictTo(...OPERATIONS), getAdminCarTypes);
router.post('/settings/car-types', protectStaff, restrictTo(...OPERATIONS), createCarType);
router.put('/settings/car-types/:id', protectStaff, restrictTo(...OPERATIONS), updateCarType);
router.delete('/settings/car-types/:id', protectStaff, restrictTo(...OPERATIONS), deleteCarType);

router.get('/settings/fuel-types', protectStaff, restrictTo(...OPERATIONS), getAdminFuelTypes);
router.post('/settings/fuel-types', protectStaff, restrictTo(...OPERATIONS), createFuelType);
router.put('/settings/fuel-types/:id', protectStaff, restrictTo(...OPERATIONS), updateFuelType);
router.delete('/settings/fuel-types/:id', protectStaff, restrictTo(...OPERATIONS), deleteFuelType);

router.get('/settings/car-brands', protectStaff, restrictTo(...OPERATIONS), getAdminCarBrands);
router.post('/settings/car-brands', protectStaff, restrictTo(...OPERATIONS), createCarBrand);
router.put('/settings/car-brands/:id', protectStaff, restrictTo(...OPERATIONS), updateCarBrand);
router.delete('/settings/car-brands/:id', protectStaff, restrictTo(...OPERATIONS), deleteCarBrand);

router.get('/settings/car-models', protectStaff, restrictTo(...OPERATIONS), getAdminCarModels);
router.post('/settings/car-models', protectStaff, restrictTo(...OPERATIONS), createCarModel);
router.put('/settings/car-models/:id', protectStaff, restrictTo(...OPERATIONS), updateCarModel);
router.delete('/settings/car-models/:id', protectStaff, restrictTo(...OPERATIONS), deleteCarModel);

router.get('/settings/conditions', protectStaff, restrictTo(...OPERATIONS), getAdminConditions);
router.post('/settings/conditions', protectStaff, restrictTo(...OPERATIONS), createCondition);
router.put('/settings/conditions/:id', protectStaff, restrictTo(...OPERATIONS), updateCondition);
router.delete('/settings/conditions/:id', protectStaff, restrictTo(...OPERATIONS), deleteCondition);

router.get('/settings/training-videos', protectStaff, restrictTo(...OPERATIONS), getAdminTrainingVideos);
router.post('/settings/training-videos', protectStaff, restrictTo(...OPERATIONS), createTrainingVideo);
router.put('/settings/training-videos/:id', protectStaff, restrictTo(...OPERATIONS), updateTrainingVideo);
router.delete('/settings/training-videos/:id', protectStaff, restrictTo(...OPERATIONS), deleteTrainingVideo);

router.post('/kits', protectStaff, restrictTo(...OPERATIONS), createKit);
router.get('/kits', protectStaff, restrictTo(...ALL_STAFF), getKits);
router.get('/kits/:id', protectStaff, restrictTo(...ALL_STAFF), getKitById);
router.put('/kits/:id', protectStaff, restrictTo(...OPERATIONS), updateKit);
router.delete('/kits/:id', protectStaff, restrictTo(...OPERATIONS), deleteKit);

router.get('/zones', protectStaff, restrictTo(...OPERATIONS), listZones);
router.post('/zones', protectStaff, restrictTo(...OPERATIONS), createZone);
router.get('/zones/:id', protectStaff, restrictTo(...OPERATIONS), getZoneById);
router.put('/zones/:id', protectStaff, restrictTo(...OPERATIONS), updateZone);
router.delete('/zones/:id', protectStaff, restrictTo(...OPERATIONS), deleteZone);

router.get('/kit-orders', protectStaff, restrictTo(...ALL_STAFF), getAdminKitOrders);
router.get('/kit-orders/:id', protectStaff, restrictTo(...ALL_STAFF), getAdminKitOrderById);
router.patch('/kit-orders/:id/approve', protectStaff, restrictTo(...ALL_STAFF), approveKitOrder);
router.patch('/kit-orders/:id/reject', protectStaff, restrictTo(...ALL_STAFF), rejectKitOrder);
router.patch('/kit-orders/:id/dispatch', protectStaff, restrictTo(...ALL_STAFF), dispatchKitOrder);
router.patch('/kit-orders/:id/deliver', protectStaff, restrictTo(...ALL_STAFF), deliverKitOrder);

export default router;
