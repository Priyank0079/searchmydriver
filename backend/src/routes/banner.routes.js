import { Router } from 'express';
import {
  adminListBanners,
  adminCreateBanner,
  adminUpdateBanner,
  adminDeleteBanner,
  adminUploadBannerMedia,
  listActiveBanners,
} from '../controllers/banner.controller.js';
import { auth, authorize } from '../middlewares/authMiddleware.js';
import { uploadMedia } from '../middlewares/multer.js';

const router = Router();

// Public routes (for user app)
router.get('/common', listActiveBanners);

// Admin routes
router.use('/admin', auth, authorize('admin', 'sub_admin'));
router.get('/admin', adminListBanners);
router.post('/admin', adminCreateBanner);
router.put('/admin/:id', adminUpdateBanner);
router.delete('/admin/:id', adminDeleteBanner);
router.post('/admin/upload', uploadMedia, adminUploadBannerMedia);

export default router;
