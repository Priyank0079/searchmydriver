import { CreditCard } from 'lucide-react';
import { SectionCard, InfoGrid } from '../DetailBlocks';
import { PAYMENT_STATUS_LABELS } from '../../../../constants/kitStatus';

const PAYMENT_DOC_STATUS_LABELS = {
  created: 'Created',
  authorized: 'Authorized',
  captured: 'Captured / Paid',
  failed: 'Failed',
  refunded: 'Refunded',
};

const PaymentDetailsCard = ({ order }) => {
  const payment = order?.payment;
  const orderPaid = order?.paymentStatus === 'paid';

  return (
    <SectionCard title="Payment details">
      <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-100">
        <span className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
          <CreditCard className="w-5 h-5 text-slate-600" />
        </span>
        <div>
          <p className="text-sm font-semibold text-slate-800">
            {payment?.provider === 'razorpay' || order?.razorpayOrderId ? 'Razorpay' : '—'}
          </p>
          <p className="text-xs text-slate-500">
            Order payment: {PAYMENT_STATUS_LABELS[order?.paymentStatus] || order?.paymentStatus}
          </p>
        </div>
      </div>

      {!payment && !order?.razorpayOrderId && (
        <p className="text-sm text-slate-500">No payment record yet.</p>
      )}

      {(payment || order?.razorpayOrderId) && (
        <InfoGrid
          items={[
            {
              label: 'Amount',
              value: `₹${(payment?.amount ?? order?.amount)?.toLocaleString('en-IN')} ${payment?.currency || order?.currency || 'INR'}`,
            },
            {
              label: 'Gateway status',
              value:
                PAYMENT_DOC_STATUS_LABELS[payment?.status] ||
                (orderPaid ? 'Captured / Paid' : payment?.status || 'Pending'),
            },
            {
              label: 'Razorpay order ID',
              value: payment?.razorpayOrderId || order?.razorpayOrderId || '—',
            },
            {
              label: 'Razorpay payment ID',
              value: payment?.razorpayPaymentId || (orderPaid ? '—' : 'Not paid yet'),
            },
            { label: 'Payment method', value: payment?.method || '—' },
            {
              label: 'Paid at',
              value: payment?.updatedAt
                ? new Date(payment.updatedAt).toLocaleString()
                : orderPaid
                  ? new Date(order.updatedAt).toLocaleString()
                  : '—',
            },
            ...(payment?.failureReason
              ? [{ label: 'Failure reason', value: payment.failureReason }]
              : []),
          ]}
        />
      )}
    </SectionCard>
  );
};

export default PaymentDetailsCard;
