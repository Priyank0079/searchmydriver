import dotenv from 'dotenv';

dotenv.config();

import { connectDB } from './config/connectDB.js';
import { initSuperAdmin } from './utils/initAdmin.js';
import app from './app.js';

connectDB().then(() => {
  initSuperAdmin();
});

const PORT = process.env.PORT || 9000;

app.listen(PORT, () => {
  console.log(`API listening on port ${PORT}`);
});
