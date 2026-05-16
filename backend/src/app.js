import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { getCorsOrigins } from './config/cors.config.js';

import commonRoutes from './routes/common.route.js';
import driverRoutes from './routes/driver.route.js';
import adminRoutes from './routes/admin.route.js';
import authRoutes from './routes/user.routes.js';

const app = express();

app.use(
  cors({
    origin: getCorsOrigins(),
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: true, limit: '16kb' }));

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/common', commonRoutes);
app.use('/api/v1/driver', driverRoutes);
app.use('/api/v1/admin', adminRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/', (_req, res) => {
  res.send('SpareDriver API');
});

app.use((err, req, res, _next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  console.error(`[ERROR] ${req.method} ${req.url} - ${err.stack}`);
  res.status(statusCode).json({
    status: statusCode,
    message,
  });
});

export default app;
