import mongoose from 'mongoose';

const carSchema = new mongoose.Schema({
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
  brand: {
    type: String,
    required: true,
    trim: true,
  },
  model: {
    type: String,
    required: true,
    trim: true,
  },
  vehicleNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true,
  },
  fuelType: {
    type: String,
    enum: ['petrol', 'diesel', 'cng', 'electric', 'hybrid'],
    required: true,
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
  }
}, { timestamps: true });

const Car = mongoose.models.Car || mongoose.model('Car', carSchema);
export default Car;
