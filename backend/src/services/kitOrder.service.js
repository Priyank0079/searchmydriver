import KitOrder from '../models/kitOrder.model.js';
import Payment from '../models/payment.model.js';
import DriverKit from '../models/driverKit.model.js';
import { Driver } from '../models/driverModels/driver.model.js';
import {
  PAYMENT_STATUS,
  KIT_ADMIN_STATUS,
  FULFILLMENT_STATUS,
  PAYMENT_PURPOSE,
  PAYMENT_PROVIDER,
} from '../constants/kitStatus.js';
import { ApiError } from '../utils/apiError.js';
import { generateKitOrderNumber } from '../utils/orderNumber.util.js';
import { createRazorpayOrder, getRazorpayKeyId } from '../utils/razorpay.js';
import { appendKitOrderHistory } from '../utils/kitOrderHistory.util.js';
import { syncDriverKitEligibility, getDriverKitEligibility } from '../utils/kitEligibility.util.js';
import { validateAndBuildItemSelections } from '../utils/kitItems.util.js';
import {
  attachReviewTasks,
  assertStaffCanActOnResource,
  assertStaffCanAccessResource,
  completeTaskForResource,
  getResourceIdScopeForStaff,
  upsertKitOrderReviewTask,
} from './adminTask.service.js';
import { TASK_TYPE } from '../constants/adminTask.js';
import AdminTask from '../models/adminTask.model.js';

function buildRazorpayCheckoutPayload(kitOrder, kit) {
  const amountPaise = Math.round(kitOrder.amount * 100);
  return {
    order: kitOrder,
    razorpay: {
      keyId: getRazorpayKeyId(),
      orderId: kitOrder.razorpayOrderId,
      amount: amountPaise,
      currency: kitOrder.currency || kit?.currency || 'INR',
      name: 'SpareDriver',
      description: kit?.name || kitOrder.kitSnapshot?.name || 'Driver Kit',
      prefill: {},
    },
  };
}

async function syncPaymentRecordForOrder(kitOrder, driverId, razorpayOrderId) {
  return Payment.findOneAndUpdate(
    { referenceId: kitOrder._id, referenceModel: 'KitOrder' },
    {
      $set: {
        provider: PAYMENT_PROVIDER.RAZORPAY,
        purpose: PAYMENT_PURPOSE.DRIVER_KIT,
        referenceId: kitOrder._id,
        referenceModel: 'KitOrder',
        razorpayOrderId,
        amount: kitOrder.amount,
        currency: kitOrder.currency,
        status: 'created',
        driverId,
        failureReason: '',
      },
      $unset: { razorpayPaymentId: 1, razorpaySignature: 1 },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

async function createFreshRazorpayOrderForKit(kitOrder, kit, driverId) {
  const amountPaise = Math.round(kitOrder.amount * 100);
  const razorpayOrder = await createRazorpayOrder({
    amountPaise,
    currency: kitOrder.currency || kit.currency,
    receipt: kitOrder.orderNumber,
    notes: { kitOrderId: String(kitOrder._id), driverId: String(driverId) },
  });

  kitOrder.razorpayOrderId = razorpayOrder.id;
  kitOrder.paymentStatus = PAYMENT_STATUS.PENDING;
  await kitOrder.save();
  await syncPaymentRecordForOrder(kitOrder, driverId, razorpayOrder.id);

  return buildRazorpayCheckoutPayload(kitOrder, kit);
}

async function findOpenOrder(driverId, kitId) {
  return KitOrder.findOne({
    driverId,
    kitId,
    paymentStatus: { $in: [PAYMENT_STATUS.PENDING, PAYMENT_STATUS.PAID] },
    adminStatus: { $in: [KIT_ADMIN_STATUS.PENDING, KIT_ADMIN_STATUS.APPROVED] },
  }).sort({ createdAt: -1 });
}

async function findAnyInProgressOrder(driverId) {
  return KitOrder.findOne({
    driverId,
    $or: [
      { paymentStatus: PAYMENT_STATUS.PENDING },
      {
        paymentStatus: PAYMENT_STATUS.PAID,
        adminStatus: KIT_ADMIN_STATUS.PENDING,
      },
    ],
  }).sort({ createdAt: -1 });
}

export const createKitOrderService = async (driverId, data) => {
  const { kitId } = data;
  if (!kitId) {
    throw new ApiError(400, 'Please select a kit to purchase');
  }

  const kit = await DriverKit.findOne({ _id: kitId, isActive: true });
  if (!kit) {
    throw new ApiError(404, 'Selected kit is not available');
  }

  const inProgress = await findAnyInProgressOrder(driverId);
  if (inProgress && String(inProgress.kitId) !== String(kit._id)) {
    throw new ApiError(
      400,
      'You already have a kit order in progress. Complete payment or wait for approval on that order first.',
    );
  }

  const approvedAny = await KitOrder.findOne({
    driverId,
    paymentStatus: PAYMENT_STATUS.PAID,
    adminStatus: KIT_ADMIN_STATUS.APPROVED,
  });
  if (approvedAny) {
    throw new ApiError(400, 'You already have an approved kit purchase');
  }

  const existing = await findOpenOrder(driverId, kit._id);
  if (existing) {
    if (existing.paymentStatus === PAYMENT_STATUS.PAID && existing.adminStatus === KIT_ADMIN_STATUS.APPROVED) {
      throw new ApiError(400, 'You already have an approved kit purchase');
    }
    if (existing.paymentStatus === PAYMENT_STATUS.PENDING) {
      return reopenPendingOrder(existing, kit, data, driverId);
    }
    if (existing.paymentStatus === PAYMENT_STATUS.PAID && existing.adminStatus === KIT_ADMIN_STATUS.PENDING) {
      throw new ApiError(400, 'Your kit purchase is awaiting admin approval');
    }
  }

  const { catalogItems, itemSelections } = validateAndBuildItemSelections(
    kit.items,
    data.itemSelections,
  );

  const amountPaise = Math.round(kit.price * 100);
  const orderNumber = generateKitOrderNumber();

  const snapshotItems = catalogItems;

  const kitOrder = await KitOrder.create({
    orderNumber,
    driverId,
    kitId: kit._id,
    kitSnapshot: {
      name: kit.name,
      price: kit.price,
      currency: kit.currency,
      items: snapshotItems,
      itemSelections,
      version: kit.version,
    },
    itemSelections,
    amount: kit.price,
    currency: kit.currency,
    paymentStatus: PAYMENT_STATUS.PENDING,
    adminStatus: KIT_ADMIN_STATUS.PENDING,
    shippingAddress: data.shippingAddress || {},
  });

  appendKitOrderHistory(kitOrder, {
    field: 'paymentStatus',
    from: '',
    to: PAYMENT_STATUS.PENDING,
    note: 'Order created',
  });
  await kitOrder.save();

  const razorpayOrder = await createRazorpayOrder({
    amountPaise,
    currency: kit.currency,
    receipt: orderNumber,
    notes: { kitOrderId: String(kitOrder._id), driverId: String(driverId) },
  });

  kitOrder.razorpayOrderId = razorpayOrder.id;
  await kitOrder.save();

  await syncPaymentRecordForOrder(kitOrder, driverId, razorpayOrder.id);

  return buildRazorpayCheckoutPayload(kitOrder, kit);
};

async function reopenPendingOrder(kitOrder, kit, data = {}, driverId) {
  if (data.shippingAddress && Object.keys(data.shippingAddress).length > 0) {
    kitOrder.shippingAddress = { ...kitOrder.shippingAddress, ...data.shippingAddress };
  }

  if (data.itemSelections?.length) {
    const { catalogItems, itemSelections } = validateAndBuildItemSelections(
      kit.items,
      data.itemSelections,
    );
    kitOrder.itemSelections = itemSelections;
    kitOrder.kitSnapshot = {
      ...kitOrder.kitSnapshot,
      items: catalogItems,
      itemSelections,
    };
  }

  return createFreshRazorpayOrderForKit(kitOrder, kit, driverId);
}

export const retryKitOrderPaymentService = async (driverId, orderId) => {
  const kitOrder = await KitOrder.findOne({ _id: orderId, driverId });
  if (!kitOrder) throw new ApiError(404, 'Order not found');

  if (kitOrder.paymentStatus === PAYMENT_STATUS.PAID) {
    throw new ApiError(400, 'This order is already paid');
  }

  if (kitOrder.paymentStatus === PAYMENT_STATUS.FAILED) {
    kitOrder.paymentStatus = PAYMENT_STATUS.PENDING;
    appendKitOrderHistory(kitOrder, {
      field: 'paymentStatus',
      from: PAYMENT_STATUS.FAILED,
      to: PAYMENT_STATUS.PENDING,
      note: 'Retrying payment',
    });
    await kitOrder.save();
  }

  if (kitOrder.adminStatus === KIT_ADMIN_STATUS.REJECTED) {
    throw new ApiError(400, 'This order was rejected. Please place a new order.');
  }

  const kit = await DriverKit.findById(kitOrder.kitId);
  if (!kit || !kit.isActive) {
    throw new ApiError(404, 'This kit is no longer available');
  }

  return createFreshRazorpayOrderForKit(kitOrder, kit, driverId);
};

export const markKitOrderPaymentFailedService = async (driverId, orderId, note = '') => {
  const kitOrder = await KitOrder.findOne({ _id: orderId, driverId });
  if (!kitOrder) throw new ApiError(404, 'Order not found');

  if (kitOrder.paymentStatus === PAYMENT_STATUS.PAID) {
    return { order: kitOrder, updated: false };
  }

  const reason = note || 'Payment attempt did not complete';

  await Payment.findOneAndUpdate(
    { referenceId: kitOrder._id, referenceModel: 'KitOrder' },
    {
      $set: { status: 'failed', failureReason: reason },
      $unset: { razorpayPaymentId: 1, razorpaySignature: 1 },
    },
    { upsert: false },
  );

  if (kitOrder.paymentStatus !== PAYMENT_STATUS.PENDING) {
    kitOrder.paymentStatus = PAYMENT_STATUS.PENDING;
    appendKitOrderHistory(kitOrder, {
      field: 'paymentStatus',
      from: PAYMENT_STATUS.FAILED,
      to: PAYMENT_STATUS.PENDING,
      note: reason,
    });
    await kitOrder.save();
  }

  return { order: kitOrder, updated: true, canRetry: true };
};

export const getDriverKitOrdersService = async (driverId) => {
  return KitOrder.find({ driverId }).sort({ createdAt: -1 }).lean();
};

export const getDriverActiveKitOrderService = async (driverId) => {
  const eligibility = await getDriverKitEligibility(driverId);
  const orders = await KitOrder.find({ driverId }).sort({ createdAt: -1 }).limit(5).lean();
  return { eligibility, orders };
};

export const getAdminKitOrdersService = async (staff, query) => {
  const {
    status,
    paymentStatus,
    adminStatus,
    search,
    assigneeId,
    page = 1,
    limit = 10,
  } = query;

  const scope = await getResourceIdScopeForStaff(
    staff,
    TASK_TYPE.KIT_ORDER_REVIEW,
    assigneeId,
    page,
    limit,
  );
  if (scope?.empty) {
    return { data: [], pagination: scope.pagination };
  }

  const filter = {};

  if (paymentStatus) filter.paymentStatus = paymentStatus;
  if (adminStatus) filter.adminStatus = adminStatus;
  if (status === 'pending_approval') {
    filter.paymentStatus = PAYMENT_STATUS.PAID;
    filter.adminStatus = KIT_ADMIN_STATUS.PENDING;
  }

  if (scope?.resourceIds) {
    filter._id = { $in: scope.resourceIds };
  }

  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

  let driverIds = null;
  if (search) {
    const drivers = await Driver.find({
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ],
    }).select('_id');
    driverIds = drivers.map((d) => d._id);
    filter.driverId = { $in: driverIds };
  }

  const total = await KitOrder.countDocuments(filter);
  const data = await KitOrder.find(filter)
    .populate('driverId', 'name phone email approvalStatus')
    .populate('kitId', 'name')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit, 10))
    .lean();

  const withTasks = await attachReviewTasks(staff, data, TASK_TYPE.KIT_ORDER_REVIEW);

  return {
    data: withTasks,
    pagination: {
      total,
      page: parseInt(page, 10),
      pages: Math.ceil(total / parseInt(limit, 10)) || 1,
    },
  };
};

export const getAdminKitOrderByIdService = async (staff, orderId) => {
  await assertStaffCanAccessResource(staff, AdminTask, TASK_TYPE.KIT_ORDER_REVIEW, orderId);

  const order = await KitOrder.findById(orderId)
    .populate('driverId', 'name phone email approvalStatus documents')
    .populate('kitId')
    .populate('reviewedBy', 'name email')
    .lean();

  if (!order) throw new ApiError(404, 'Order not found');

  let payment = null;
  if (order.paymentId) {
    payment = await Payment.findById(order.paymentId).lean();
  }
  if (!payment) {
    payment = await Payment.findOne({
      referenceId: order._id,
      referenceModel: 'KitOrder',
    }).lean();
  }

  return {
    ...order,
    payment: payment
      ? {
          _id: payment._id,
          provider: payment.provider,
          purpose: payment.purpose,
          status: payment.status,
          amount: payment.amount,
          currency: payment.currency,
          method: payment.method,
          razorpayOrderId: payment.razorpayOrderId,
          razorpayPaymentId: payment.razorpayPaymentId,
          failureReason: payment.failureReason,
          createdAt: payment.createdAt,
          updatedAt: payment.updatedAt,
        }
      : order.razorpayOrderId
        ? {
            status: order.paymentStatus === PAYMENT_STATUS.PAID ? 'captured' : 'created',
            amount: order.amount,
            currency: order.currency,
            razorpayOrderId: order.razorpayOrderId,
            razorpayPaymentId: null,
          }
        : null,
  };
};

export const approveKitOrderService = async (staff, orderId, note = '') => {
  await assertStaffCanActOnResource(staff, TASK_TYPE.KIT_ORDER_REVIEW, orderId);

  const order = await KitOrder.findById(orderId);
  if (!order) throw new ApiError(404, 'Order not found');

  if (order.paymentStatus !== PAYMENT_STATUS.PAID) {
    throw new ApiError(400, 'Payment must be completed before approval');
  }

  const prev = order.adminStatus;
  order.adminStatus = KIT_ADMIN_STATUS.APPROVED;
  order.adminNote = note || order.adminNote;
  order.reviewedBy = staff._id;
  order.reviewedAt = new Date();
  appendKitOrderHistory(order, {
    field: 'adminStatus',
    from: prev,
    to: KIT_ADMIN_STATUS.APPROVED,
    note: note || 'Approved',
    by: staff._id,
  });
  await order.save();
  await syncDriverKitEligibility(order.driverId);
  await completeTaskForResource(staff, TASK_TYPE.KIT_ORDER_REVIEW, orderId, {
    action: 'approved',
    note: note || 'Approved',
  });
  return order;
};

export const rejectKitOrderService = async (staff, orderId, note) => {
  const trimmed = (note || '').trim();
  if (trimmed.length < 10) {
    throw new ApiError(400, 'Rejection note is required (minimum 10 characters)');
  }

  await assertStaffCanActOnResource(staff, TASK_TYPE.KIT_ORDER_REVIEW, orderId);

  const order = await KitOrder.findById(orderId);
  if (!order) throw new ApiError(404, 'Order not found');

  const prev = order.adminStatus;
  order.adminStatus = KIT_ADMIN_STATUS.REJECTED;
  order.adminNote = trimmed;
  order.reviewedBy = staff._id;
  order.reviewedAt = new Date();
  appendKitOrderHistory(order, {
    field: 'adminStatus',
    from: prev,
    to: KIT_ADMIN_STATUS.REJECTED,
    note: trimmed,
    by: staff._id,
  });
  await order.save();
  await syncDriverKitEligibility(order.driverId);
  await completeTaskForResource(staff, TASK_TYPE.KIT_ORDER_REVIEW, orderId, {
    action: 'rejected',
    note: trimmed,
  });
  return order;
};

export const dispatchKitOrderService = async (staffId, orderId, data) => {
  const { carrier, trackingId, trackingUrl } = data;
  if (!carrier || !trackingId) {
    throw new ApiError(400, 'Carrier and tracking ID are required');
  }

  const order = await KitOrder.findById(orderId);
  if (!order) throw new ApiError(404, 'Order not found');
  if (order.adminStatus !== KIT_ADMIN_STATUS.APPROVED) {
    throw new ApiError(400, 'Order must be approved before dispatch');
  }

  const prev = order.fulfillmentStatus;
  order.fulfillmentStatus = FULFILLMENT_STATUS.DISPATCHED;
  order.tracking = {
    carrier,
    trackingId,
    trackingUrl: trackingUrl || '',
    dispatchedAt: new Date(),
    deliveredAt: null,
  };
  appendKitOrderHistory(order, {
    field: 'fulfillmentStatus',
    from: prev,
    to: FULFILLMENT_STATUS.DISPATCHED,
    note: `Tracking: ${trackingId}`,
    by: staffId,
  });
  await order.save();
  return order;
};

export const markKitOrderDeliveredService = async (staffId, orderId) => {
  const order = await KitOrder.findById(orderId);
  if (!order) throw new ApiError(404, 'Order not found');

  const prev = order.fulfillmentStatus;
  order.fulfillmentStatus = FULFILLMENT_STATUS.DELIVERED;
  order.tracking.deliveredAt = new Date();
  appendKitOrderHistory(order, {
    field: 'fulfillmentStatus',
    from: prev,
    to: FULFILLMENT_STATUS.DELIVERED,
    note: 'Marked delivered',
    by: staffId,
  });
  await order.save();
  return order;
};
