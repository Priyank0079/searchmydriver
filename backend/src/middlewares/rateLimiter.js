import rateLimit from 'express-rate-limit';

// Parse env limits with fallback defaults
const authLimitMax = process.env.AUTH_LIMIT_MAX 
  ? parseInt(process.env.AUTH_LIMIT_MAX, 10) 
  : (process.env.NODE_ENV === 'development' ? 1000 : 30);

const globalLimitMax = process.env.GLOBAL_LIMIT_MAX 
  ? parseInt(process.env.GLOBAL_LIMIT_MAX, 10) 
  : (process.env.NODE_ENV === 'development' ? 5000 : 300);

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: authLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { 
    status: 429, 
    message: 'Too many OTP/login attempts, please try again later.' 
  }
});

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: globalLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { 
    status: 429, 
    message: 'Too many requests, please try again later.' 
  }
});
