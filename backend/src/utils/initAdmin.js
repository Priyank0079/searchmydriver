import bcrypt from 'bcryptjs';
import User from '../models/user.model.js';
import { USER_ROLES } from '../constants/roles.js';

export const initSuperAdmin = async () => {
  try {
    const adminExists = await User.findOne({ role: USER_ROLES.ADMIN });

    if (!adminExists) {
      console.log('[SYSTEM] No admin found. Initializing default Super Admin...');

      const email = process.env.ADMIN_DEFAULT_EMAIL || 'admin@searchmydriver.com';
      const password = process.env.ADMIN_DEFAULT_PASSWORD || 'admin123';

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const superAdmin = new User({
        name: 'Super Admin',
        email,
        phone_no: '0000000000',
        password: hashedPassword,
        role: USER_ROLES.ADMIN,
      });

      await superAdmin.save();
      console.log(`[SYSTEM] Super Admin created successfully! Email: ${email}`);
    } else {
      console.log('[SYSTEM] Admin already exists. Skipping initialization.');
    }
  } catch (error) {
    console.error('[SYSTEM] Error initializing Super Admin:', error);
  }
};
