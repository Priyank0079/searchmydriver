import { Router } from 'express';
import {
  adminListBanners,
  adminCreateBanner,
  adminUpdateBanner,
  adminDeleteBanner,
  adminUploadBannerMedia,
  listActiveBanners,
} from '../controllers/banner.controller.js';
import { protectStaff, restrictTo } from '../middlewares/authMiddleware.js';
import { uploadAdMedia } from '../middlewares/multer.js';

const router = Router();

// Public routes (for user app)
router.get('/common', listActiveBanners);

// Admin routes
router.use('/admin', protectStaff, restrictTo('admin', 'sub_admin'));
router.get('/admin', adminListBanners);
router.post('/admin', adminCreateBanner);
router.put('/admin/:id', adminUpdateBanner);
router.delete('/admin/:id', adminDeleteBanner);
router.post('/admin/upload', uploadAdMedia.single('media'), adminUploadBannerMedia);

export default router;
