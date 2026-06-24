import { Notification } from '../models/notification.model.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

function getRecipientDetails(req) {
  if (req.user) return { recipientId: req.user._id, recipientModel: 'User' };
  if (req.driver) return { recipientId: req.driver._id, recipientModel: 'Driver' };
  if (req.staff) return { recipientModel: 'Admin' }; // Admins share global notifications
  return null;
}

export const getNotifications = asyncHandler(async (req, res) => {
  const recipient = getRecipientDetails(req);
  if (!recipient) {
    return res.status(401).json(new ApiResponse(401, null, 'Unauthorized'));
  }

  const query = {};
  if (recipient.recipientModel === 'Admin') {
    query.recipientModel = 'Admin';
  } else {
    query.recipientId = recipient.recipientId;
    query.recipientModel = recipient.recipientModel;
  }

  const notifications = await Notification.find(query)
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  const unreadCount = await Notification.countDocuments({ ...query, isRead: false });

  return res.status(200).json(
    new ApiResponse(200, { notifications, unreadCount }, 'Notifications fetched')
  );
});

export const markAsRead = asyncHandler(async (req, res) => {
  const recipient = getRecipientDetails(req);
  if (!recipient) {
    return res.status(401).json(new ApiResponse(401, null, 'Unauthorized'));
  }

  const notification = await Notification.findById(req.params.id);
  if (!notification) {
    return res.status(404).json(new ApiResponse(404, null, 'Notification not found'));
  }

  // Ensure they own it (unless they are admin)
  if (recipient.recipientModel !== 'Admin') {
    if (String(notification.recipientId) !== String(recipient.recipientId)) {
      return res.status(403).json(new ApiResponse(403, null, 'Forbidden'));
    }
  }

  notification.isRead = true;
  await notification.save();

  return res.status(200).json(new ApiResponse(200, notification, 'Marked as read'));
});

export const markAllAsRead = asyncHandler(async (req, res) => {
  const recipient = getRecipientDetails(req);
  if (!recipient) {
    return res.status(401).json(new ApiResponse(401, null, 'Unauthorized'));
  }

  const query = { isRead: false };
  if (recipient.recipientModel === 'Admin') {
    query.recipientModel = 'Admin';
  } else {
    query.recipientId = recipient.recipientId;
    query.recipientModel = recipient.recipientModel;
  }

  await Notification.updateMany(query, { $set: { isRead: true } });

  return res.status(200).json(new ApiResponse(200, null, 'All notifications marked as read'));
});
