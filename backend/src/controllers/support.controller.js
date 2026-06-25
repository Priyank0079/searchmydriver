import SupportTicket from '../models/supportTicket.model.js';
import { ApiError } from '../utils/ApiError.js';
import { emitToAdmins, emitNotification } from '../utils/socketEmitters.js';
import { S2C_EVENTS } from '../constants/socketEvents.js';

export const createSupportTicket = async (req, res, next) => {
  try {
    const { subject, description } = req.body;
    const isUser = !!req.user;
    const isDriver = !!req.driver;

    if (!isUser && !isDriver) {
      throw new ApiError(401, 'Unauthorized');
    }

    if (!subject || !description) {
      throw new ApiError(400, 'Subject and description are required');
    }

    const ticket = await SupportTicket.create({
      creatorType: isUser ? 'user' : 'driver',
      userId: isUser ? req.user._id : undefined,
      driverId: isDriver ? req.driver._id : undefined,
      subject,
      description,
    });

    const populatedTicket = await SupportTicket.findById(ticket._id)
      .populate('userId', 'name phone_no')
      .populate('driverId', 'name phone')
      .lean();

    // Alert admins
    emitToAdmins(S2C_EVENTS.ADMIN_ALERT, {
      type: 'support_ticket',
      message: `New Help Desk Ticket from ${isUser ? populatedTicket.userId.name : populatedTicket.driverId.name}`,
      ticketId: ticket._id,
    });
    emitNotification({ admin: true }, {
      title: 'New Help Desk Ticket',
      body: `Ticket submitted by ${isUser ? populatedTicket.userId.name : populatedTicket.driverId.name}`,
      severity: 'info'
    });

    res.status(201).json({ success: true, ticket: populatedTicket });
  } catch (err) {
    next(err);
  }
};

export const createPublicSupportTicket = async (req, res, next) => {
  try {
    const { subject, description, contactName, contactPhone, creatorType } = req.body;

    if (!subject || !description || !contactName || !contactPhone || !creatorType) {
      throw new ApiError(400, 'All fields are required');
    }

    const ticket = await SupportTicket.create({
      creatorType,
      subject,
      description,
      contactName,
      contactPhone,
    });

    emitToAdmins(S2C_EVENTS.ADMIN_ALERT, {
      type: 'support_ticket',
      message: `New Public Help Desk Ticket from ${contactName}`,
      ticketId: ticket._id,
    });
    emitNotification({ admin: true }, {
      title: 'New Public Ticket',
      body: `Help Desk ticket from ${contactName}`,
      severity: 'warning'
    });

    res.status(201).json({ success: true, ticket });
  } catch (err) {
    next(err);
  }
};

export const getAdminSupportTickets = async (req, res, next) => {
  try {
    const tickets = await SupportTicket.find()
      .populate('userId', 'name phone_no')
      .populate('driverId', 'name phone')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, tickets });
  } catch (err) {
    next(err);
  }
};

export const resolveSupportTicket = async (req, res, next) => {
  try {
    const { id } = req.params;
    const ticket = await SupportTicket.findByIdAndUpdate(
      id,
      { status: 'resolved', resolvedAt: new Date() },
      { new: true }
    )
      .populate('userId', 'name phone_no')
      .populate('driverId', 'name phone')
      .lean();

    if (!ticket) {
      throw new ApiError(404, 'Ticket not found');
    }

    res.json({ success: true, ticket });
  } catch (err) {
    next(err);
  }
};
