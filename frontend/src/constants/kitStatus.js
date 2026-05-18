export const PAYMENT_STATUS_LABELS = {
  pending: 'Awaiting payment',
  paid: 'Paid',
  failed: 'Payment failed',
  refunded: 'Refunded',
};

export const ADMIN_STATUS_LABELS = {
  pending: 'Awaiting approval',
  approved: 'Approved',
  rejected: 'Rejected',
};

export const FULFILLMENT_STATUS_LABELS = {
  not_started: 'Not dispatched',
  dispatched: 'Dispatched',
  in_transit: 'In transit',
  delivered: 'Delivered',
  failed: 'Delivery failed',
};

export function formatKitStatus(status) {
  return (
    PAYMENT_STATUS_LABELS[status] ||
    ADMIN_STATUS_LABELS[status] ||
    FULFILLMENT_STATUS_LABELS[status] ||
    status?.replace(/_/g, ' ') ||
    '—'
  );
}
