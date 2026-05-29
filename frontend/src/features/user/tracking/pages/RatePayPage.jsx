import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../../../components/Card';
import Button from '../../../../components/Button';
import Avatar from '../../../../components/Avatar';
import StarRating from '../../../../components/StarRating';
import useUserActiveBookingStore from '../../../../store/user/useUserActiveBookingStore';

/**
 * Post-ride rating screen — the driver header is now backed by the real
 * driver object the booking ended on, so the user is rating the actual
 * person who drove them rather than a hardcoded mock.
 */
const RatePayPage = () => {
  const navigate = useNavigate();
  const booking = useUserActiveBookingStore((s) => s.booking);
  const fetchActive = useUserActiveBookingStore((s) => s.fetchActive);
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');

  useEffect(() => {
    if (!booking) fetchActive().catch(() => {});
  }, [booking, fetchActive]);

  const driverObj = typeof booking?.driverId === 'object' ? booking?.driverId : null;
  const driverName = driverObj?.name || 'Your driver';
  const totalFare = useMemo(() => {
    const base = booking?.fareSnapshot?.total || 0;
    const extensions = (booking?.extensions || []).reduce(
      (sum, ext) => sum + (ext?.fareDelta || 0),
      0,
    );
    return base + extensions || null;
  }, [booking]);

  return (
    <div className="flex-1 flex flex-col bg-white min-h-dvh px-6 pt-16 pb-8">
      <div className="flex-1 flex flex-col items-center">
        <h1 className="text-xl font-bold text-text mb-2 animate-fade-in-up">
          How was your experience?
        </h1>
        <p className="text-sm text-text-muted mb-6 animate-fade-in-up">
          Rate {driverName}
        </p>

        <div className="animate-fade-in-up mb-6 flex items-center gap-3">
          <Avatar name={driverName} size="xl" />
          <div className="text-left">
            <p className="font-semibold text-text">{driverName}</p>
            {totalFare != null ? (
              <p className="text-xs text-text-muted">Trip total · ₹{totalFare}</p>
            ) : null}
          </div>
        </div>

        <div className="animate-bounce-in mb-8">
          <StarRating value={rating} onChange={setRating} size="lg" showLabel />
        </div>

        <Card className="w-full animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <textarea
            placeholder="Write a review (optional)"
            value={review}
            onChange={(e) => setReview(e.target.value)}
            rows={3}
            className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </Card>
      </div>

      <Button fullWidth onClick={() => navigate('/user/tracking/invoice')} disabled={!rating}>
        Submit
      </Button>
    </div>
  );
};

export default RatePayPage;
