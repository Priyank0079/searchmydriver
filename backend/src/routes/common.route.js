import express from 'express';
import { uploadImage } from '../controllers/common.controller.js';
import { getCarTypes, getConditions } from '../controllers/platform.controller.js';
import { upload } from '../middlewares/multer.js';

const router = express.Router();

router.post('/upload', upload.single('image'), uploadImage);

// Publicly available config
router.get('/car-types', getCarTypes);
router.get('/conditions', getConditions);

export default router;
