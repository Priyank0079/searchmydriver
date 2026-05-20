import mongoose from 'mongoose';
import { ZONE_SHAPE, ZONE_SHAPE_VALUES } from '../constants/zoneShapes.js';

const zoneSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 64,
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500,
    },
    city: {
      type: String,
      default: '',
      trim: true,
      maxlength: 80,
    },
    shapeType: {
      type: String,
      enum: ZONE_SHAPE_VALUES,
      default: ZONE_SHAPE.CIRCLE,
      index: true,
    },
    center: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
        required: true,
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },
    radiusKm: {
      type: Number,
      default: null,
      min: 0.5,
      max: 100,
    },
    boundary: {
      type: {
        type: String,
        enum: ['Polygon'],
      },
      coordinates: {
        type: [[[Number]]],
      },
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true },
);

zoneSchema.pre('save', function cleanBoundary(next) {
  const coords = this.boundary?.coordinates;
  const hasValidBoundary =
    Array.isArray(coords) &&
    coords.length > 0 &&
    Array.isArray(coords[0]) &&
    coords[0].length >= 4;

  if (this.shapeType === ZONE_SHAPE.CIRCLE || !hasValidBoundary) {
    this.set('boundary', undefined);
  }
  next();
});

zoneSchema.index({ center: '2dsphere' });
zoneSchema.index({ boundary: '2dsphere' }, { sparse: true });
zoneSchema.index({ isActive: 1, sortOrder: 1 });

const Zone = mongoose.models.Zone || mongoose.model('Zone', zoneSchema);
export default Zone;
