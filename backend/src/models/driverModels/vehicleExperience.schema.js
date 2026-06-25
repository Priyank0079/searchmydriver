import mongoose from 'mongoose';

/** One vehicle the driver has experience driving (onboarding step 2). */
const vehicleExperienceSchema = new mongoose.Schema(
  {
    carTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CarType',
      required: true,
    },
    brandId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CarBrand',
    },
    modelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CarModel',
    },
    fuelTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FuelType',
    },
    transmission: {
      type: String,
      enum: ['manual', 'automatic'],
      required: true,
    },
  },
  { _id: true },
);

export default vehicleExperienceSchema;
