import { useNavigate } from 'react-router-dom';
import { ChevronRight, Package } from 'lucide-react';
import Card from '../../../../components/Card';
import Button from '../../../../components/Button';
import OrderStatusBadges from './OrderStatusBadges';
import PayNowButton from '../../kit/components/PayNowButton';

const DriverOrderCard = ({ order, onClick, onPaid }) => {
  const navigate = useNavigate();

  return (
    <Card className={onClick ? 'hover:border-primary/30 transition-colors' : ''}>
      <div
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onClick={onClick}
        onKeyDown={
          onClick
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') onClick();
              }
            : undefined
        }
        className={onClick ? 'cursor-pointer' : ''}
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-mono text-[10px] text-text-muted">{order.orderNumber}</p>
            <p className="font-bold text-text text-sm mt-0.5 truncate">{order.title}</p>
            <p className="text-sm text-primary font-semibold mt-1">
              ₹{order.amount?.toLocaleString('en-IN')}
            </p>
            <OrderStatusBadges order={order} compact />
            <p className="text-xs text-text-muted mt-2">
              {new Date(order.createdAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
              {order.itemCount > 0 && ` · ${order.itemCount} item${order.itemCount === 1 ? '' : 's'}`}
            </p>
          </div>
          {onClick && !order.canPayNow && (
            <ChevronRight className="w-4 h-4 text-text-muted shrink-0 mt-2" />
          )}
        </div>
      </div>

      {order.canPayNow && (
        <PayNowButton orderId={order.id} onPaid={onPaid} className="mt-4 py-3" />
      )}

      {order.canReorder && (
        <Button
          variant="outline"
          fullWidth
          className="mt-3 rounded-full"
          onClick={() => navigate('/driver/kit')}
        >
          Place new order
        </Button>
      )}
    </Card>
  );
};

export default DriverOrderCard;
