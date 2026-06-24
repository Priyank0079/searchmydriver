import mongoose from 'mongoose';

const carSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
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
    modelName: {
      type: String,
      trim: true,
    },
    fuelTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FuelType',
    },
    vehicleNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    transmission: {
      type: String,
      enum: ['manual', 'automatic'],
      required: true,
    },
    image: {
      type: String,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

const Car = mongoose.models.Car || mongoose.model('Car', carSchema);
export default Car;
