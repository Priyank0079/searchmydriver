import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, Phone, MessageSquare, Loader2 } from 'lucide-react';
import Card from '../../../../components/Card';
import Button from '../../../../components/Button';
import Avatar from '../../../../components/Avatar';
import TripTrackingMap from '../../../../components/maps/TripTrackingMap';
import useUserActiveBookingStore from '../../../../store/user/useUserActiveBookingStore';
import { useFirebaseDriverLocations } from '../../../../hooks/useFirebaseDriverLocations';
import { formatDistance, estimateEtaMinutes, haversineMeters } from '../../../../utils/geo';
import { BOOKING_STATUS } from '../../../../constants/bookingStatus';

/**
 * "Driver is on the way" tracking screen — pulls the live booking out of
 * the active-booking store and renders the production trip map on top.
 *
 * If the user lands here without an active booking (legacy bookmark, demo
 * navigation, etc.) we still show the screen with a friendly stub so the
 * design reference remains useful, but no fabricated driver data is
 * rendered.
 */
const DriverOnWayPage = () => {
  const navigate = useNavigate();
  const booking = useUserActiveBookingStore((s) => s.booking);
  const fetchActive = useUserActiveBookingStore((s) => s.fetchActive);

  useEffect(() => {
    if (!booking) fetchActive().catch(() => {});
  }, [booking, fetchActive]);

  // Live driver location via Firebase Realtime DB (same pipeline as the
  // production assigned-driver screen).
  const driverObj = typeof booking?.driverId === 'object' ? booking?.driverId : null;
  const driverId = driverObj?._id || (typeof booking?.driverId === 'string' ? booking.driverId : null);
  const { map: liveDrivers, disabled: firebaseDisabled } = useFirebaseDriverLocations();
  const liveDriver = driverId ? liveDrivers[String(driverId)] : null;

  const pickupPoint = useMemo(() => {
    const c = booking?.pickup?.location?.coordinates;
    if (!Array.isArray(c) || c.length !== 2) return null;
    return { lat: c[1], lng: c[0] };
  }, [booking?.pickup]);

  const driverPoint = useMemo(() => {
    if (!liveDriver) return null;
    return { lat: liveDriver.lat, lng: liveDriver.lng, heading: liveDriver.heading };
  }, [liveDriver]);

  const { distanceMeters, etaMinutes } = useMemo(() => {
    if (!driverPoint || !pickupPoint) return { distanceMeters: null, etaMinutes: null };
    const d = haversineMeters(driverPoint, pickupPoint);
    return { distanceMeters: d, etaMinutes: estimateEtaMinutes(d) };
  }, [driverPoint, pickupPoint]);

  // Auto-route to the appropriate screen as the booking progresses.
  useEffect(() => {
    if (!booking?.status) return;
    if (booking.status === BOOKING_STATUS.ARRIVED) {
      navigate('/user/tracking/reached', { replace: true });
    } else if (booking.status === BOOKING_STATUS.STARTED) {
      navigate('/user/tracking/in-progress', { replace: true });
    }
  }, [booking?.status, navigate]);

  const driverName = driverObj?.name || 'Your driver';
  const driverRating = driverObj?.rating;

  return (
    <div className="flex-1 flex flex-col bg-bg min-h-dvh">
      {pickupPoint ? (
        <TripTrackingMap
          driver={driverPoint}
          pickup={pickupPoint}
          height={288}
          showRoute
          emphasis="driver"
        />
      ) : (
        <div className="h-72 bg-[#f4efe6] flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
        </div>
      )}

      <div className="flex-1 -mt-6 z-10">
        <Card className="mx-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
            <span className="text-sm font-medium text-success">
              {liveDriver ? 'Driver on the way' : 'Locating your driver…'}
            </span>
          </div>
          <div className="flex items-center gap-3 mb-4">
            <Avatar name={driverName} size="lg" online={!!liveDriver} />
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-text truncate">{driverName}</h3>
              <div className="flex items-center gap-1 mt-0.5">
                {driverRating ? (
                  <>
                    <Star className="w-3.5 h-3.5 text-primary fill-primary" />
                    <span className="text-sm">{driverRating}</span>
                  </>
                ) : null}
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                {liveDriver
                  ? distanceMeters
                    ? `${formatDistance(distanceMeters)} away`
                    : 'Heading to pickup'
                  : firebaseDisabled
                    ? 'Live updates disabled in this build'
                    : 'Awaiting first location…'}
              </p>
            </div>
            {etaMinutes ? (
              <div className="text-right">
                <p className="text-[10px] text-text-muted uppercase tracking-wide">ETA</p>
                <p className="text-lg font-bold text-text">{etaMinutes} min</p>
              </div>
            ) : null}
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" size="md" className="flex-1" icon={Phone}>Call</Button>
            <Button variant="secondary" size="md" className="flex-1" icon={MessageSquare}>Message</Button>
          </div>
        </Card>

        {booking?.pickup?.address ? (
          <div className="mx-4 mt-3">
            <Card>
              <p className="text-[11px] uppercase tracking-wide text-text-muted">Pickup</p>
              <p className="text-sm font-medium text-text break-words mt-0.5">
                {booking.pickup.address}
              </p>
              {booking?.outstation?.destinationAddress && (
                <>
                  <p className="text-[11px] uppercase tracking-wide text-text-muted mt-3">Drop</p>
                  <p className="text-sm font-medium text-text break-words mt-0.5">
                    {booking.outstation.destinationAddress}
                  </p>
                </>
              )}
            </Card>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default DriverOnWayPage;
