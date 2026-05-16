import mongoose from 'mongoose';

const platformConditionSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true,
    trim: true,
  },
  key: {
    type: String, // Internal key like 'has_dashcam', 'has_fastag'
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  isRequired: {
    type: Boolean,
    default: false,
  },
  isActive: {
    type: Boolean,
    default: true,
  }
}, { timestamps: true });

const PlatformCondition = mongoose.models.PlatformCondition || mongoose.model('PlatformCondition', platformConditionSchema);
export default PlatformCondition;
