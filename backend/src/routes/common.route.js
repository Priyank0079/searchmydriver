import express from 'express';
import { uploadImage, uploadVideo } from '../controllers/common.controller.js';
import { getCarTypes, getConditions, getTrainingVideos } from '../controllers/platform.controller.js';
import {
  getFuelTypes,
  getCarBrands,
  getCarModels,
} from '../controllers/vehicleCatalog.controller.js';
import { upload, uploadVideo as uploadVideoMiddleware } from '../middlewares/multer.js';

const router = express.Router();

router.post('/upload', upload.single('image'), uploadImage);
router.post('/upload/video', uploadVideoMiddleware.single('video'), uploadVideo);

// Publicly available config
router.get('/car-types', getCarTypes);
router.get('/fuel-types', getFuelTypes);
router.get('/car-brands', getCarBrands);
router.get('/car-models', getCarModels);
router.get('/conditions', getConditions);
router.get('/training-videos', getTrainingVideos);

export default router;
