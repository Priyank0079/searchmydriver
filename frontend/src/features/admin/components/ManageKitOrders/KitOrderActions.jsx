import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../../../components/Button';
import Input from '../../../../components/Input';
import api from '../../../../utils/api';
import toast from 'react-hot-toast';

const KitOrderActions = ({ order, onSuccess, onReviewComplete }) => {
  const navigate = useNavigate();
  const [note, setNote] = useState('');
  const [carrier, setCarrier] = useState('');
  const [trackingId, setTrackingId] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [submitting, setSubmitting] = useState(null);

  if (!order) return null;

  const canApprove = order.paymentStatus === 'paid' && order.adminStatus === 'pending';
  const canDispatch = order.adminStatus === 'approved' && order.fulfillmentStatus === 'not_started';
  const canDeliver =
    order.adminStatus === 'approved' &&
    ['dispatched', 'in_transit'].includes(order.fulfillmentStatus);

  const run = async (action, payload = {}) => {
    setSubmitting(action);
    try {
      if (action === 'approve') {
        await api.patch(`/admin/kit-orders/${order._id}/approve`, { note });
        toast.success('Order approved');
        onReviewComplete?.('approved');
        navigate('/admin/kit-orders', { replace: true });
        return;
      }
      if (action === 'reject') {
        await api.patch(`/admin/kit-orders/${order._id}/reject`, { note });
        toast.success('Order rejected');
        onReviewComplete?.('rejected');
        navigate('/admin/kit-orders', { replace: true });
        return;
      }
      if (action === 'dispatch') {
        await api.patch(`/admin/kit-orders/${order._id}/dispatch`, {
          carrier,
          trackingId,
          trackingUrl,
        });
        toast.success('Order dispatched');
      } else if (action === 'deliver') {
        await api.patch(`/admin/kit-orders/${order._id}/deliver`);
        toast.success('Marked as delivered');
      }
      onSuccess?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
      <h2 className="text-sm font-semibold text-slate-800">Order actions</h2>

      {canApprove && (
        <div className="space-y-3">
          <Input
            label="Note (optional for approve)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="admin"
              size="md"
              fullWidth
              loading={submitting === 'approve'}
              onClick={() => run('approve')}
            >
              Approve purchase
            </Button>
            <Button
              variant="danger"
              size="md"
              fullWidth
              loading={submitting === 'reject'}
              onClick={() => {
                if (note.trim().length < 10) {
                  toast.error('Rejection note required (min 10 characters)');
                  return;
                }
                run('reject');
              }}
            >
              Reject
            </Button>
          </div>
        </div>
      )}

      {canDispatch && (
        <div className="space-y-3 pt-4 border-t border-slate-100">
          <p className="text-xs font-semibold uppercase text-slate-400">Dispatch</p>
          <Input label="Carrier" value={carrier} onChange={(e) => setCarrier(e.target.value)} />
          <Input label="Tracking ID" value={trackingId} onChange={(e) => setTrackingId(e.target.value)} />
          <Input label="Tracking URL" value={trackingUrl} onChange={(e) => setTrackingUrl(e.target.value)} />
          <Button variant="admin" size="md" fullWidth loading={submitting === 'dispatch'} onClick={() => run('dispatch')}>
            Mark dispatched
          </Button>
        </div>
      )}

      {canDeliver && (
        <Button variant="outline" size="md" fullWidth loading={submitting === 'deliver'} onClick={() => run('deliver')}>
          Mark delivered
        </Button>
      )}

      {!canApprove && !canDispatch && !canDeliver && (
        <p className="text-sm text-slate-500">No actions available for this order state.</p>
      )}
    </div>
  );
};

export default KitOrderActions;
