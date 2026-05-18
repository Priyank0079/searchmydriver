import {
  ADMIN_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  FULFILLMENT_STATUS_LABELS,
} from '../../../../constants/kitStatus';

const badgeClass = 'text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-slate-100 text-slate-600';

const OrderStatusBadges = ({ order, compact = false }) => (
  <div className={`flex flex-wrap gap-2 ${compact ? '' : 'mt-3'}`}>
    <span className={badgeClass}>
      {PAYMENT_STATUS_LABELS[order.paymentStatus] || order.paymentStatus}
    </span>
    {order.paymentStatus === 'paid' && (
      <span className={badgeClass}>
        {ADMIN_STATUS_LABELS[order.adminStatus] || order.adminStatus}
      </span>
    )}
    {order.paymentStatus === 'paid' && order.adminStatus === 'approved' && (
      <span className={badgeClass}>
        {FULFILLMENT_STATUS_LABELS[order.fulfillmentStatus] || order.fulfillmentStatus}
      </span>
    )}
  </div>
);

export default OrderStatusBadges;
