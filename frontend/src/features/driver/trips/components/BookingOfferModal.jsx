import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Clock, SkipForward, Loader2, IndianRupee, Navigation } from 'lucide-react';
import useDriverIncomingOfferStore from '../../../../store/driver/useDriverIncomingOfferStore';
import { useSocketEvent } from '../../../../hooks/useSocket';
import { useNotificationSound } from '../../../../hooks/useNotificationSound';
import { S2C_EVENTS } from '../../../../constants/socketEvents';
import { SERVICE_TYPES, SERVICE_TYPE_LABELS } from '../../../../constants/serviceTypes';
import { formatDistance } from '../../../../utils/geo';
import Button from '../../../../components/Button';

/** The asset that rings when a new offer arrives. Reused across the app. */
const OFFER_ALERT_SRC = '/audio/alert_.mp3';

function CountdownBar({ expiresAt }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  const total = 30_000;
  const remaining = Math.max(0, new Date(expiresAt).getTime() - now);
  const pct = Math.max(0, Math.min(100, (remaining / total) * 100));
  const seconds = Math.ceil(remaining / 1000);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-text-muted">
        <span>Decide soon</span>
        <span className="font-bold text-text">{seconds}s</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-[width] duration-200 ease-linear"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

const BookingOfferModal = () => {
  const offer = useDriverIncomingOfferStore((s) => s.offer);
  const busy = useDriverIncomingOfferStore((s) => s.busy);
  const error = useDriverIncomingOfferStore((s) => s.error);
  const setOffer = useDriverIncomingOfferStore((s) => s.setOffer);
  const clearOffer = useDriverIncomingOfferStore((s) => s.clearOffer);
  const acceptOffer = useDriverIncomingOfferStore((s) => s.accept);
  const rejectOffer = useDriverIncomingOfferStore((s) => s.reject);
  const navigate = useNavigate();

  // Looping alert tone that rings while an offer is on screen. Stops the
  // moment the offer is cleared (accept / skip / server-side withdrawal).
  const { play: playAlert, stop: stopAlert } = useNotificationSound(OFFER_ALERT_SRC, {
    loop: true,
    volume: 0.9,
  });

  // Inbound offer from server → push into the store.
  useSocketEvent(S2C_EVENTS.BOOKING_OFFERED, (payload) => {
    setOffer(payload);
  });

  // Server withdrew the offer (timeout / cancellation / picked someone else).
  useSocketEvent(S2C_EVENTS.BOOKING_OFFER_WITHDRAWN, (payload) => {
    const current = useDriverIncomingOfferStore.getState().offer;
    if (!current || current.bookingId === payload?.bookingId) {
      clearOffer();
    }
  });

  // Ring while there's an active offer; silence otherwise. Keyed on the
  // bookingId so a back-to-back new offer restarts the tone instead of
  // continuing the previous loop.
  useEffect(() => {
    if (offer?.bookingId) {
      playAlert();
      return () => stopAlert();
    }
    stopAlert();
    return undefined;
  }, [offer?.bookingId, playAlert, stopAlert]);

  if (!offer) return null;

  const handleAccept = async () => {
    try {
      const booking = await acceptOffer();
      stopAlert();
      if (booking?._id) {
        navigate(`/driver/trip/${booking._id}`);
      }
    } catch {
      /* error surfaced inline */
    }
  };

  const handleSkip = async () => {
    try {
      await rejectOffer();
      stopAlert();
    } catch {
      /* error surfaced inline */
    }
  };

  const title =
    offer.serviceType === SERVICE_TYPES.OUTSTATION
      ? `${offer.outstation?.days || 1}-day Outstation`
      : `${offer.hourly?.durationHours || ''}h ${SERVICE_TYPE_LABELS.hourly}`;

  // Distance from the driver to the customer's pickup (server-computed during
  // dispatch). Helps the driver decide whether the offer is worth taking.
  const pickupDistanceLabel =
    typeof offer.distanceMeters === 'number'
      ? formatDistance(offer.distanceMeters)
      : null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-slide-up">
        <div className="relative bg-primary/10 px-5 py-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary-dark">
                New booking offer
              </p>
              <h2 className="text-xl font-bold text-text mt-1">{title}</h2>
            </div>
            {pickupDistanceLabel && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase px-2 py-1 rounded-full bg-primary/15 text-primary-dark">
                <Navigation className="w-3 h-3" />
                {pickupDistanceLabel} to pickup
              </span>
            )}
          </div>
          <p className="text-xs text-text-muted mt-1">#{offer.bookingNumber}</p>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-start gap-3">
            <MapPin className="w-4 h-4 text-success mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] text-text-muted">Pickup</p>
              <p className="text-sm font-medium text-text break-words">{offer.pickup?.address}</p>
              {pickupDistanceLabel && (
                <p className="text-[11px] text-primary-dark font-semibold mt-0.5">
                  {pickupDistanceLabel} away from you
                </p>
              )}
            </div>
          </div>

          {offer.serviceType === SERVICE_TYPES.OUTSTATION && offer.outstation?.destinationAddress && (
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-danger mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[11px] text-text-muted">Destination</p>
                <p className="text-sm font-medium text-text break-words">
                  {offer.outstation.destinationAddress}
                </p>
              </div>
            </div>
          )}

          {offer.serviceType === SERVICE_TYPES.HOURLY && offer.hourly?.scheduledStartAt && (
            <div className="flex items-start gap-3">
              <Clock className="w-4 h-4 text-text-muted mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[11px] text-text-muted">Scheduled start</p>
                <p className="text-sm font-medium text-text">
                  {new Date(offer.hourly.scheduledStartAt).toLocaleString()}
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between bg-bg rounded-2xl p-3">
            <div className="flex items-center gap-2">
              <IndianRupee className="w-4 h-4 text-text-muted" />
              <div>
                <p className="text-[11px] text-text-muted">Estimated fare</p>
                <p className="text-base font-bold text-text">₹{offer.fare?.total || 0}</p>
              </div>
            </div>
            {offer.offerExpiresAt && <CountdownBar expiresAt={offer.offerExpiresAt} />}
          </div>

          {error && (
            <div className="text-xs text-danger bg-danger/10 rounded-xl px-3 py-2">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="secondary"
              fullWidth
              onClick={handleSkip}
              disabled={busy === 'accept'}
              loading={busy === 'reject'}
              icon={SkipForward}
            >
              Skip
            </Button>
            <Button
              fullWidth
              onClick={handleAccept}
              disabled={busy === 'reject'}
              loading={busy === 'accept'}
            >
              {busy === 'accept' ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Accepting…
                </span>
              ) : (
                'Accept'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingOfferModal;
