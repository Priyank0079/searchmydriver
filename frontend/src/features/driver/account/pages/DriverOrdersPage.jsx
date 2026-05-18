import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useCachedQuery } from '../../../../hooks/useCachedQuery';
import { buildCacheKey } from '../../../../store/lib/buildCacheKey';
import { useDriverOrdersStore } from '../../../../store/driver/useDriverHistoryStore';
import { useDriverKitActiveStore } from '../../../../store/driver/useDriverKitStore';
import DriverOrderCard from '../components/DriverOrderCard';

const DriverOrdersPage = () => {
  const navigate = useNavigate();
  const cacheKey = buildCacheKey('driver-orders', {});

  const { data, loading, refetch } = useCachedQuery(useDriverOrdersStore, cacheKey, {});
  const orders = Array.isArray(data?.orders) ? data.orders : [];

  const handlePaid = () => {
    refetch();
    useDriverKitActiveStore.getState().invalidate('driver-kit-active');
  };

  return (
    <div className="flex-1 flex flex-col bg-bg min-h-dvh">
      <div className="bg-white px-4 pt-4 pb-4 shadow-sm flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-2 -ml-2">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg font-bold">My orders</h1>
          <p className="text-xs text-text-muted">Kit purchases and more</p>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-3">
        {loading && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        )}
        {!loading && orders.length === 0 && (
          <p className="text-sm text-text-muted text-center py-8">No orders yet</p>
        )}
        {!loading &&
          orders.map((order) => (
            <DriverOrderCard
              key={order.id}
              order={order}
              onClick={() => navigate(`/driver/orders/${order.id}`)}
              onPaid={handlePaid}
            />
          ))}
      </div>
    </div>
  );
};

export default DriverOrdersPage;
