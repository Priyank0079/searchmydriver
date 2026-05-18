import { useNavigate } from 'react-router-dom';
import { Loader2, ShoppingBag } from 'lucide-react';
import { useCachedQuery } from '../../../../hooks/useCachedQuery';
import { buildCacheKey } from '../../../../store/lib/buildCacheKey';
import { useDriverOrdersStore } from '../../../../store/driver/useDriverHistoryStore';
import DriverOrderCard from './DriverOrderCard';
import Button from '../../../../components/Button';

const AccountOrdersSection = () => {
  const navigate = useNavigate();
  const cacheKey = buildCacheKey('driver-orders', {});

  const { data, loading, refetch } = useCachedQuery(useDriverOrdersStore, cacheKey, {});
  const orders = Array.isArray(data?.orders) ? data.orders : [];
  const summary = data?.summary ?? {};
  const recentOrders = orders.slice(0, 3);

  return (
    <section className="mt-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-5 h-5 text-primary" />
          <h2 className="text-base font-bold text-text">My orders</h2>
        </div>
        {orders.length > 0 && (
          <button
            type="button"
            onClick={() => navigate('/driver/orders')}
            className="text-xs font-semibold text-primary"
          >
            View all
          </button>
        )}
      </div>

      {summary.total > 0 && (
        <p className="text-xs text-text-muted mb-3">
          {summary.total} order{summary.total === 1 ? '' : 's'}
          {summary.pendingPayment > 0 && ` · ${summary.pendingPayment} awaiting payment`}
          {summary.awaitingApproval > 0 && ` · ${summary.awaitingApproval} awaiting approval`}
        </p>
      )}

      {loading && (
        <div className="flex justify-center py-8">
          <Loader2 className="w-7 h-7 text-primary animate-spin" />
        </div>
      )}

      {!loading && orders.length === 0 && (
        <div className="bg-white rounded-2xl shadow-card p-6 text-center">
          <p className="text-sm text-text-muted">No orders yet</p>
          <p className="text-xs text-text-muted mt-1">Kit purchases and trip orders will appear here</p>
          <Button
            variant="outline"
            className="mt-4 rounded-full"
            onClick={() => navigate('/driver/kit')}
          >
            Browse driver kits
          </Button>
        </div>
      )}

      {!loading && recentOrders.length > 0 && (
        <div className="space-y-3">
          {recentOrders.map((order) => (
            <DriverOrderCard
              key={order.id}
              order={order}
              onClick={() => navigate(`/driver/orders/${order.id}`)}
              onPaid={refetch}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export default AccountOrdersSection;
