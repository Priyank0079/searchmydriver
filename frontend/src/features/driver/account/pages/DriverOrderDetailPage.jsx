import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, MapPin } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import Card from '../../../../components/Card';
import Button from '../../../../components/Button';
import api from '../../../../utils/api';
import OrderStatusBadges from '../components/OrderStatusBadges';
import KitOrderItemsList from '../../kit/components/KitOrderItemsList';
import PayNowButton from '../../kit/components/PayNowButton';
import { useDriverOrdersStore } from '../../../../store/driver/useDriverHistoryStore';

const DriverOrderDetailPage = () => {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadOrder = useCallback(() => {
    if (!orderId) return;
    setLoading(true);
    api
      .get(`/driver/orders/${orderId}`)
      .then((res) => setOrder(res.data?.data || null))
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
  }, [orderId]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  const handlePaid = () => {
    useDriverOrdersStore.getState().invalidate('driver-orders');
    loadOrder();
  };

  const address = order?.shippingAddress;

  return (
    <div className="flex-1 flex flex-col bg-bg min-h-dvh">
      <div className="bg-white px-4 pt-4 pb-4 shadow-sm flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-2 -ml-2">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold">Order details</h1>
      </div>

      <div className="flex-1 p-4 space-y-4">
        {loading && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        )}
        {!loading && !order && (
          <p className="text-sm text-text-muted text-center py-8">Order not found</p>
        )}
        {order && (
          <>
            <Card className="space-y-4">
              <div>
                <p className="font-mono text-xs text-text-muted">{order.orderNumber}</p>
                <p className="font-bold text-lg text-text mt-1">{order.title}</p>
                <p className="text-xl font-bold text-primary mt-2">
                  ₹{order.amount?.toLocaleString('en-IN')}
                </p>
                <OrderStatusBadges order={order} />
                <p className="text-xs text-text-muted mt-3">
                  Placed on{' '}
                  {new Date(order.createdAt).toLocaleString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>

              {order.itemSelections?.length > 0 && (
                <div className="pt-4 border-t border-slate-100">
                  <KitOrderItemsList selections={order.itemSelections} title="Items" />
                </div>
              )}

              {address?.line1 && (
                <div className="pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    <p className="text-xs font-semibold text-text-muted uppercase">Delivery address</p>
                  </div>
                  <p className="text-sm text-text">{address.line1}</p>
                  {address.line2 && <p className="text-sm text-text">{address.line2}</p>}
                  <p className="text-sm text-text-secondary mt-1">
                    {[address.city, address.state, address.pincode].filter(Boolean).join(', ')}
                  </p>
                  {address.phone && (
                    <p className="text-sm text-text-muted mt-1">Phone: {address.phone}</p>
                  )}
                </div>
              )}
            </Card>

            {order.canPayNow && (
              <PayNowButton orderId={order.id} onPaid={handlePaid} className="py-4" />
            )}

            {order.canReorder && (
              <Button fullWidth className="rounded-full" onClick={() => navigate('/driver/kit')}>
                Place new order
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default DriverOrderDetailPage;
