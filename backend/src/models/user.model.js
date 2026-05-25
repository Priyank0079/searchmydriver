import mongoose from 'mongoose';

const savedLocationSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      trim: true,
      maxlength: 60,
      default: '',
    },
    address: {
      type: String,
      trim: true,
      required: true,
      maxlength: 300,
    },
    city: {
      type: String,
      trim: true,
      default: '',
      maxlength: 120,
    },
    lat: {
      type: Number,
      required: true,
      min: -90,
      max: 90,
    },
    lng: {
      type: Number,
      required: true,
      min: -180,
      max: 180,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    googleId: {
      type: String,
      trim: true,
      sparse: true,
      unique: true,
    },
    authProvider: {
      type: String,
      enum: ['local', 'google'],
      default: 'local',
    },
    phone_no: {
      type: String,
      trim: true,
      sparse: true,
      unique: true,
    },
    password: {
      type: String,
      minlength: 6,
      select: false,
    },
    role: {
      type: String,
      enum: ['user', 'admin', 'sub_admin', 'team_member', 'driver'],
      default: 'user',
    },
    profilePicture: {
      type: String,
      default: '',
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    isPhoneVerified: {
      type: Boolean,
      default: false,
    },
    fcmToken: {
      type: String,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    conditions: [
      {
        conditionId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'PlatformCondition',
        },
        value: {
          type: Boolean,
          default: null,
        },
      }
    ],
    savedLocations: {
      type: [savedLocationSchema],
      default: [],
      validate: {
        validator: (arr) => !arr || arr.length <= 20,
        message: 'You can save up to 20 favourite locations',
      },
    },
  },
  {
    timestamps: true,
  }
);

const User = mongoose.models.User || mongoose.model('User', userSchema);
export default User;
