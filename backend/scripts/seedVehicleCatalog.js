/**
 * Seeds car categories, fuel types, brands, and models.
 * Run from backend/: npm run seed:vehicle-catalog
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import FuelType from '../src/models/fuelType.model.js';
import CarBrand from '../src/models/carBrand.model.js';
import CarModel from '../src/models/carModel.model.js';
import CarType from '../src/models/carType.model.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

const FUEL_TYPES = ['Petrol', 'Diesel', 'CNG', 'Electric', 'Hybrid'];

const CATEGORIES = [
  { name: 'hatchback', description: 'Compact hatchback cars' },
  { name: 'sedan', description: 'Sedan / saloon cars' },
  { name: 'suv', description: 'SUV and crossovers' },
  { name: 'muv', description: 'MUV / MPV family vehicles' },
  { name: 'luxury', description: 'Luxury segment' },
];

/** brand -> [{ name, category }] */
const BRAND_MODELS = {
  'Maruti Suzuki': [
    { name: 'Swift', category: 'hatchback' },
    { name: 'Baleno', category: 'hatchback' },
    { name: 'Dzire', category: 'sedan' },
    { name: 'Wagon R', category: 'hatchback' },
    { name: 'Ertiga', category: 'muv' },
  ],
  Hyundai: [
    { name: 'i20', category: 'hatchback' },
    { name: 'Creta', category: 'suv' },
    { name: 'Venue', category: 'suv' },
    { name: 'Verna', category: 'sedan' },
    { name: 'Alcazar', category: 'muv' },
  ],
  Tata: [
    { name: 'Nexon', category: 'suv' },
    { name: 'Punch', category: 'suv' },
    { name: 'Harrier', category: 'suv' },
    { name: 'Altroz', category: 'hatchback' },
    { name: 'Tiago', category: 'hatchback' },
  ],
  Honda: [
    { name: 'City', category: 'sedan' },
    { name: 'Amaze', category: 'sedan' },
    { name: 'Elevate', category: 'suv' },
  ],
  Toyota: [
    { name: 'Innova', category: 'muv' },
    { name: 'Fortuner', category: 'suv' },
    { name: 'Glanza', category: 'hatchback' },
    { name: 'Hyryder', category: 'suv' },
  ],
  Kia: [
    { name: 'Seltos', category: 'suv' },
    { name: 'Sonet', category: 'suv' },
    { name: 'Carens', category: 'muv' },
  ],
  Mahindra: [
    { name: 'XUV700', category: 'suv' },
    { name: 'Scorpio N', category: 'suv' },
    { name: 'Thar', category: 'suv' },
    { name: 'Bolero', category: 'muv' },
  ],
  Volkswagen: [
    { name: 'Virtus', category: 'sedan' },
    { name: 'Taigun', category: 'suv' },
  ],
  Skoda: [
    { name: 'Slavia', category: 'sedan' },
    { name: 'Kushaq', category: 'suv' },
  ],
  MG: [
    { name: 'Hector', category: 'suv' },
    { name: 'Astor', category: 'suv' },
    { name: 'Comet', category: 'hatchback' },
  ],
};

async function upsertCategory({ name, description }) {
  const key = name.toLowerCase().trim();
  return CarType.findOneAndUpdate(
    { name: key },
    { name: key, description: description || '', isActive: true },
    { upsert: true, new: true },
  );
}

async function seed() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set in backend/.env');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  let fuelCount = 0;
  for (let i = 0; i < FUEL_TYPES.length; i += 1) {
    await FuelType.findOneAndUpdate(
      { name: FUEL_TYPES[i] },
      { name: FUEL_TYPES[i], sortOrder: i, isActive: true },
      { upsert: true },
    );
    fuelCount += 1;
  }

  const categoryMap = {};
  for (const cat of CATEGORIES) {
    const doc = await upsertCategory(cat);
    categoryMap[cat.name] = doc;
  }

  let brandCount = 0;
  let modelCount = 0;
  const brandNames = Object.keys(BRAND_MODELS);

  for (let i = 0; i < brandNames.length; i += 1) {
    const brandName = brandNames[i];
    const brand = await CarBrand.findOneAndUpdate(
      { name: brandName },
      { name: brandName, sortOrder: i, isActive: true },
      { upsert: true, new: true },
    );
    brandCount += 1;

    const models = BRAND_MODELS[brandName];
    for (let j = 0; j < models.length; j += 1) {
      const { name: modelName, category } = models[j];
      const carType = categoryMap[category] || categoryMap.sedan;

      await CarModel.findOneAndUpdate(
        { brandId: brand._id, name: modelName },
        {
          name: modelName,
          brandId: brand._id,
          carTypeId: carType._id,
          sortOrder: j,
          isActive: true,
        },
        { upsert: true },
      );
      modelCount += 1;
    }
  }

  console.log('Seed complete:');
  console.log(`  Categories: ${CATEGORIES.length}`);
  console.log(`  Fuel types: ${fuelCount}`);
  console.log(`  Brands: ${brandCount}`);
  console.log(`  Models: ${modelCount}`);

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
