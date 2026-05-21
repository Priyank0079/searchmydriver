import dotenv from 'dotenv';

dotenv.config();

import { createServer } from 'node:http';
import { connectDB } from './config/connectDB.js';
import { initSuperAdmin } from './utils/initAdmin.js';
import { initializeSocket } from './config/socket.js';
import { initializeFirebase } from './config/firebase.js';
import app from './app.js';

const PORT = process.env.PORT || 9000;

async function bootstrap() {
  await connectDB();
  await initSuperAdmin();
  await initializeFirebase();

  const httpServer = createServer(app);
  initializeSocket(httpServer);

  httpServer.listen(PORT, () => {
    console.log(`API listening on port ${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('❌ Server bootstrap failed:', err);
  process.exit(1);
});
