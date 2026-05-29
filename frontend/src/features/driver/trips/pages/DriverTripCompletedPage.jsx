import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Clock, MapPin, Car } from 'lucide-react';
import Card from '../../../../components/Card';
import Button from '../../../../components/Button';
import useDriverActiveTripStore from '../../../../store/driver/useDriverActiveTripStore';
import { formatDistance } from '../../../../utils/geo';
import { SERVICE_TYPE_LABELS } from '../../../../constants/serviceTypes';

/**
 * Driver-side trip summary — pulls earnings, duration, distance and the
 * service-type label out of the real booking instead of the previous
 * hardcoded mock. The "Total Earnings" figure is the driver-payout
 * snapshot when present, falling back to the customer-facing total
 * otherwise.
 */
const DriverTripCompletedPage = () => {
  const navigate = useNavigate();
  const booking = useDriverActiveTripStore((s) => s.booking);

  // Don't auto-refetch — by the time the driver hits this screen the
  // booking has been cleared from /active. The store still holds the last
  // snapshot, which is what we want to render.
  useEffect(() => {
    if (!booking) navigate('/driver/home', { replace: true });
  }, [booking, navigate]);

  const totalEarnings = useMemo(() => {
    if (!booking) return null;
    return (
      booking.driverPayout?.totalRupees ??
      booking.payment?.driverShareRupees ??
      booking.fareSnapshot?.total ??
      null
    );
  }, [booking]);

  const distanceMeters =
    booking?.distanceMeters ??
    booking?.fareSnapshot?.distanceMeters ??
    booking?.tripSummary?.distanceMeters ??
    null;

  const durationLabel = useMemo(() => {
    const started = booking?.timeline?.startedAt;
    const completed = booking?.timeline?.completedAt;
    if (!started || !completed) return '—';
    const diffMs = new Date(completed).getTime() - new Date(started).getTime();
    if (!Number.isFinite(diffMs) || diffMs <= 0) return '—';
    const total = Math.floor(diffMs / 1000);
    const h = String(Math.floor(total / 3600)).padStart(2, '0');
    const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
    const s = String(total % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }, [booking]);

  const tripTypeLabel = booking?.serviceType
    ? SERVICE_TYPE_LABELS[booking.serviceType] || booking.serviceType
    : '—';

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-white min-h-dvh px-6">
      <div className="animate-bounce-in mb-5">
        <div className="w-20 h-20 bg-success-light rounded-full flex items-center justify-center">
          <CheckCircle className="w-10 h-10 text-success" />
        </div>
      </div>
      <p className="text-sm text-text-muted mb-1">Trip Completed</p>
      <div className="mb-2">
        <p className="text-xs text-text-muted">Total Earnings</p>
        <p className="text-3xl font-bold text-text text-center">
          {totalEarnings != null ? `₹${totalEarnings}` : '—'}
        </p>
      </div>
      <p className="text-sm text-text-secondary mb-6 text-center">
        Thank you for completing the trip.
      </p>

      <Card className="w-full animate-fade-in-up mb-6">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <Clock className="w-5 h-5 text-text-muted mx-auto mb-1" />
            <p className="text-sm font-bold">{durationLabel}</p>
            <p className="text-[10px] text-text-muted">Duration</p>
          </div>
          <div>
            <MapPin className="w-5 h-5 text-text-muted mx-auto mb-1" />
            <p className="text-sm font-bold">
              {distanceMeters != null ? formatDistance(distanceMeters) : '—'}
            </p>
            <p className="text-[10px] text-text-muted">Distance</p>
          </div>
          <div>
            <Car className="w-5 h-5 text-text-muted mx-auto mb-1" />
            <p className="text-sm font-bold">{tripTypeLabel}</p>
            <p className="text-[10px] text-text-muted">Trip Type</p>
          </div>
        </div>
      </Card>

      <Button fullWidth onClick={() => navigate('/driver/trip/payment')}>COMPLETE</Button>
    </div>
  );
};

export default DriverTripCompletedPage;
