import mongoose from 'mongoose';
import {
  TASK_STATUS,
  TASK_CATEGORY,
  TASK_RESOURCE_MODEL,
  TASK_TYPES,
  OPEN_TASK_STATUSES,
  getTaskTypeConfig,
} from '../constants/adminTask.js';

const activityLogSchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    byName: { type: String, default: '' },
    note: { type: String, default: '' },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const adminTaskSchema = new mongoose.Schema(
  {
    taskType: {
      type: String,
      enum: TASK_TYPES,
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: Object.values(TASK_CATEGORY),
      required: true,
      index: true,
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    resourceModel: {
      type: String,
      enum: Object.values(TASK_RESOURCE_MODEL),
      required: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    status: {
      type: String,
      enum: Object.values(TASK_STATUS),
      default: TASK_STATUS.OPEN,
      index: true,
    },
    priority: {
      type: String,
      enum: ['normal', 'high', 'urgent'],
      default: 'normal',
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    assignedAt: { type: Date, default: null },
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    completedAt: { type: Date, default: null },
    completedAction: { type: String, default: '' },
    /** Optional type-specific payload (ticket id, channel, etc.) */
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    activityLog: { type: [activityLogSchema], default: [] },
  },
  { timestamps: true },
);

adminTaskSchema.index({ taskType: 1, resourceId: 1, status: 1 });
adminTaskSchema.index({ category: 1, status: 1, assignedTo: 1 });
adminTaskSchema.index({ assignedTo: 1, status: 1, createdAt: -1 });
adminTaskSchema.index(
  { taskType: 1, resourceId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: OPEN_TASK_STATUSES },
    },
  },
);

adminTaskSchema.pre('validate', function setCategoryFromRegistry(next) {
  if (!this.category && this.taskType) {
    const config = getTaskTypeConfig(this.taskType);
    if (config) this.category = config.category;
  }
  next();
});

const AdminTask =
  mongoose.models.AdminTask || mongoose.model('AdminTask', adminTaskSchema);
export default AdminTask;
