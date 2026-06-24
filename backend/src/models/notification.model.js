import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
    },
    recipientModel: {
      type: String,
      required: true,
      enum: ['User', 'Driver', 'Admin'],
    },
    title: {
      type: String,
      required: true,
    },
    body: {
      type: String,
      required: true,
    },
    severity: {
      type: String,
      enum: ['info', 'success', 'warning', 'error'],
      default: 'info',
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient querying by recipient
notificationSchema.index({ recipientId: 1, recipientModel: 1, createdAt: -1 });

export const Notification = mongoose.model('Notification', notificationSchema);
