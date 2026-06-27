import { Router } from 'express';
import {
  adminListFaqs,
  adminCreateFaq,
  adminUpdateFaq,
  adminDeleteFaq,
  listActiveFaqs,
} from '../controllers/webFaq.controller.js';
import { protectStaff, restrictTo } from '../middlewares/authMiddleware.js';

const router = Router();

// Public routes (for public website)
router.get('/common', listActiveFaqs);

// Admin routes
router.use('/admin', protectStaff, restrictTo('admin', 'sub_admin'));
router.get('/admin', adminListFaqs);
router.post('/admin', adminCreateFaq);
router.put('/admin/:id', adminUpdateFaq);
router.delete('/admin/:id', adminDeleteFaq);

export default router;
