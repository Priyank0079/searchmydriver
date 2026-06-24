import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

import User from '../src/models/user.model.js';

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');

    const passwordHash = await bcrypt.hash('123456', 10);

    // 1. Seed regular User
    const userPhone = '9999999999';
    await User.findOneAndUpdate(
      { phone_no: userPhone },
      {
        name: 'Test User',
        phone_no: userPhone,
        password: passwordHash,
        role: 'user',
        isPhoneVerified: true,
        isActive: true,
      },
      { upsert: true, new: true }
    );
    console.log(`Seeded User: ${userPhone}`);

    // 2. Seed Driver
    const driverPhone = '8888888888';
    await User.findOneAndUpdate(
      { phone_no: driverPhone },
      {
        name: 'Test Driver',
        phone_no: driverPhone,
        password: passwordHash,
        role: 'driver',
        isPhoneVerified: true,
        isActive: true,
      },
      { upsert: true, new: true }
    );
    console.log(`Seeded Driver: ${driverPhone}`);

    console.log('Seeding complete!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding:', error);
    process.exit(1);
  }
}

seed();
