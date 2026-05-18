import express from 'express';
import { razorpayWebhook } from '../controllers/payment.controller.js';

const router = express.Router();

router.post('/razorpay', express.raw({ type: 'application/json' }), (req, res, next) => {
  req.rawBody = req.body?.toString?.('utf8') || '';
  try {
    req.body = JSON.parse(req.rawBody);
  } catch {
    req.body = {};
  }
  next();
}, razorpayWebhook);

export default router;
