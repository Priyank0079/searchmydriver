import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../../../components/Card';
import Button from '../../../../components/Button';
import Avatar from '../../../../components/Avatar';
import StarRating from '../../../../components/StarRating';
import useDriverActiveTripStore from '../../../../store/driver/useDriverActiveTripStore';

/**
 * Driver-side rating screen — surfaces the real customer just rated.
 * Same shape as the user-side `RatePayPage` so the design language stays
 * consistent across both ends of the platform.
 */
const RateCustomerPage = () => {
  const navigate = useNavigate();
  const booking = useDriverActiveTripStore((s) => s.booking);
  const clear = useDriverActiveTripStore((s) => s.clear);
  const [rating, setRating] = useState(0);

  const customer = booking?.userId;
  const customerName =
    typeof customer === 'object' && customer?.name ? customer.name : 'Customer';

  // Once we land here the trip is over — drop the active booking after the
  // page mounts so future "active trip" lookups return null.
  useEffect(() => {
    return () => {
      clear();
    };
  }, [clear]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-white min-h-dvh px-6">
      <h1 className="text-xl font-bold text-text mb-2 animate-fade-in-up">
        Rate Customer
      </h1>
      <p className="text-sm text-text-muted mb-6 animate-fade-in-up">
        How was your experience with the customer?
      </p>

      <Card className="w-full animate-fade-in-up mb-6">
        <div className="flex items-center gap-3">
          <Avatar name={customerName} size="lg" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-text truncate">{customerName}</p>
            <p className="text-xs text-text-muted truncate">
              {booking?.bookingNumber || 'Recent trip'}
            </p>
          </div>
        </div>
      </Card>

      <div className="animate-bounce-in mb-8">
        <StarRating value={rating} onChange={setRating} size="lg" showLabel />
      </div>

      <div className="w-full animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
        <Button fullWidth disabled={!rating} onClick={() => navigate('/driver/home')}>
          SUBMIT RATING
        </Button>
      </div>
    </div>
  );
};

export default RateCustomerPage;
