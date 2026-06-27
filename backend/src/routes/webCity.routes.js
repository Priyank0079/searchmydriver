import { Router } from 'express';
import {
  adminListCities,
  adminCreateCity,
  adminUpdateCity,
  adminDeleteCity,
  adminUploadCityMedia,
  listActiveCities,
} from '../controllers/webCity.controller.js';
import { protectStaff, restrictTo } from '../middlewares/authMiddleware.js';
import { uploadAdMedia } from '../middlewares/multer.js';

const router = Router();

// Public routes (for public website)
router.get('/common', listActiveCities);

// Admin routes
router.use('/admin', protectStaff, restrictTo('admin', 'sub_admin'));
router.get('/admin', adminListCities);
router.post('/admin', adminCreateCity);
router.put('/admin/:id', adminUpdateCity);
router.delete('/admin/:id', adminDeleteCity);
router.post('/admin/upload', uploadAdMedia.single('media'), adminUploadCityMedia);

export default router;
