import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  MapPin,
  Clock,
  Car,
  Calendar,
  CircleDot,
  Loader2,
} from 'lucide-react';
import Card from '../../../../components/Card';
import Button from '../../../../components/Button';
import api from '../../../../utils/api';
import useBookingDraftStore from '../../../../store/user/useBookingDraftStore';
import useUserActiveBookingStore from '../../../../store/user/useUserActiveBookingStore';
import { SERVICE_TYPES, SERVICE_TYPE_LABELS } from '../../../../constants/serviceTypes';
import { getCarBrandName, getCarModelName } from '../../../../utils/vehicleCatalog';

const ReviewBookingPage = () => {
  const navigate = useNavigate();
  const draft = useBookingDraftStore();
  const setFareEstimate = useBookingDraftStore((s) => s.setFareEstimate);
  const createBooking = useUserActiveBookingStore((s) => s.createBooking);

  const [estimate, setEstimate] = useState(draft.fareEstimate);
  const [estimating, setEstimating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCar, setSelectedCar] = useState(null);

  useEffect(() => {
    if (!draft.serviceType || !draft.pickup) {
      navigate('/user/book/service', { replace: true });
    }
  }, [draft.serviceType, draft.pickup, navigate]);

  // Resolve the selected car for the trip summary. Keep it tolerant —
  // if the fetch fails we just hide the car block instead of breaking review.
  useEffect(() => {
    let cancelled = false;
    if (!draft.carId) {
      setSelectedCar(null);
      return undefined;
    }
    api
      .get('/auth/cars')
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res?.data?.data) ? res.data.data : [];
        setSelectedCar(list.find((c) => c._id === draft.carId) || null);
      })
      .catch(() => {
        if (!cancelled) setSelectedCar(null);
      });
    return () => {
      cancelled = true;
    };
  }, [draft.carId]);

  const serviceType = draft.serviceType;
  const hourlySlabId = draft.hourly.slabId;
  const hourlyDuration = draft.hourly.durationHours;
  const hourlyStart = draft.hourly.scheduledStartAt;
  const outstationDays = draft.outstation.days;
  const outstationStart = draft.outstation.startDate;
  const outstationNeedsFood = draft.outstation.needsFood;
  const outstationNeedsStay = draft.outstation.needsStay;

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setEstimating(true);
      setError(null);
      try {
        const payload = { serviceType };
        if (serviceType === SERVICE_TYPES.HOURLY) {
          payload.slabId = hourlySlabId;
          payload.bookedHours = hourlyDuration;
          payload.scheduledAt = hourlyStart;
        } else {
          payload.days = outstationDays;
          payload.scheduledAt = outstationStart;
          payload.foodProvided = outstationNeedsFood;
          payload.stayProvided = outstationNeedsStay;
        }
        const res = await api.post('/auth/bookings/estimate', payload);
        const data = res?.data?.data || null;
        if (cancelled) return;
        setEstimate(data);
        setFareEstimate(data);
      } catch (err) {
        if (cancelled) return;
        const message = err?.response?.data?.message || 'Failed to estimate fare';
        setError(message);
      } finally {
        if (!cancelled) setEstimating(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [
    serviceType,
    hourlySlabId,
    hourlyDuration,
    hourlyStart,
    outstationDays,
    outstationStart,
    outstationNeedsFood,
    outstationNeedsStay,
    setFareEstimate,
  ]);

  const total = estimate?.fareBreakdown?.totalPayable ?? 0;

  const handleConfirm = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const payload = draft.buildCreatePayload();
      const { booking } = await createBooking(payload);
      if (booking) {
        navigate('/user/book/searching');
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not place booking');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-bg min-h-dvh">
      <div className="bg-white px-4 pt-4 pb-4 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl hover:bg-gray-100">
            <ArrowLeft className="w-5 h-5 text-text" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-text">Review your booking</h1>
            <p className="text-xs text-text-muted">Confirm details and choose how to pay.</p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-4">
        <TripSummary draft={draft} car={selectedCar} />
        <FareCard estimate={estimate} estimating={estimating} error={error} />
        <p className="text-[11px] text-text-muted text-center">
          You'll pick how to pay (now or after the ride) once a driver accepts.
        </p>
      </div>

      <div className="p-4 bg-white border-t border-border-light">
        <Button
          fullWidth
          loading={submitting}
          disabled={!estimate || estimating}
          onClick={handleConfirm}
        >
          {`Confirm booking · ₹${total}`}
        </Button>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */

function TripSummary({ draft, car }) {
  const isHourly = draft.serviceType === SERVICE_TYPES.HOURLY;
  const schedule = isHourly ? draft.hourly?.scheduledStartAt : draft.outstation?.startDate;
  const dropAddress = draft.dropoff?.address || draft.outstation?.destinationAddress;

  return (
    <Card>
      <div className="space-y-4">
        <div className="flex gap-3">
          <div className="flex flex-col items-center gap-1 pt-1">
            <CircleDot className="w-4 h-4 text-success" />
            {!isHourly && dropAddress && (
              <>
                <div className="w-0.5 h-8 bg-gray-200" />
                <MapPin className="w-4 h-4 text-danger" />
              </>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div>
              <p className="text-xs text-text-muted">Pickup</p>
              <p className="text-sm font-medium text-text break-words">{draft.pickup?.address}</p>
            </div>
            {!isHourly && dropAddress && (
              <div className="mt-3">
                <p className="text-xs text-text-muted">Destination</p>
                <p className="text-sm font-medium text-text break-words">{dropAddress}</p>
              </div>
            )}
          </div>
        </div>

        {car && (
          <>
            <div className="h-px bg-border-light" />
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gray-100 overflow-hidden flex items-center justify-center shrink-0">
                {car.image ? (
                  <img src={car.image} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Car className="w-5 h-5 text-text-muted" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-text-muted">Your car</p>
                <p className="text-sm font-semibold text-text truncate">
                  {getCarBrandName(car)} · {getCarModelName(car)}
                </p>
                <p className="text-[11px] font-mono text-text-secondary">{car.vehicleNumber}</p>
              </div>
            </div>
          </>
        )}

        <div className="h-px bg-border-light" />

        <div className="grid grid-cols-2 gap-3">
          <FactRow
            icon={Calendar}
            label={isHourly ? 'Pickup time' : 'Trip dates'}
            value={
              isHourly
                ? schedule
                  ? new Date(schedule).toLocaleString()
                  : '—'
                : `${formatDate(draft.outstation?.startDate)} → ${formatDate(draft.outstation?.endDate)}`
            }
          />
          <FactRow
            icon={Clock}
            label={isHourly ? 'Duration' : 'Days'}
            value={
              isHourly
                ? `${draft.hourly?.durationHours || 0} h`
                : `${draft.outstation?.days || 1} day · ${draft.outstation?.nights || 0} night`
            }
          />
          <FactRow icon={Car} label="Service" value={SERVICE_TYPE_LABELS[draft.serviceType]} />
          {!isHourly && (
            <FactRow
              icon={MapPin}
              label="Driver stay/food"
              value={`${draft.outstation?.needsStay ? 'We arrange stay' : 'Customer arranges'}, ${draft.outstation?.needsFood ? 'we arrange food' : 'customer arranges'}`}
            />
          )}
        </div>
      </div>
    </Card>
  );
}

function FareCard({ estimate, estimating, error }) {
  const rows = useMemo(() => {
    const bd = estimate?.fareBreakdown || {};
    // Map pricing-engine field names to user-friendly labels. Outstation uses
    // `dailyRateTotal`/`stayChargeTotal`/`foodAllowanceTotal`, hourly uses
    // `packagePrice`/`foodAllowance`.
    return [
      ['Base fare', bd.packagePrice ?? bd.dailyRateTotal ?? 0],
      ['Extra hours', bd.extraHourCharge],
      ['Waiting', bd.waitingCharge],
      ['Night charge', bd.nightCharge],
      ['Stay charges', bd.stayChargeTotal ?? bd.nightHaltTotal],
      ['Food allowance', bd.foodAllowance ?? bd.foodAllowanceTotal],
      ['Extra km', bd.extraKmCharge],
      ['Toll & parking', bd.tollParking],
      ['Service charge', bd.serviceCharge],
      ['GST', bd.gstAmount],
      [
        'Subscription discount',
        bd.subscriptionDiscount ? -Math.abs(bd.subscriptionDiscount) : 0,
      ],
    ].filter(([, v]) => Number(v || 0) !== 0);
  }, [estimate]);
  const total = estimate?.fareBreakdown?.totalPayable || 0;

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text">Fare estimate</h3>
        {estimating && <Loader2 className="w-4 h-4 animate-spin text-text-muted" />}
      </div>

      {error && <div className="text-xs text-danger bg-danger/10 rounded-xl px-3 py-2">{error}</div>}

      {!error && (
        <div className="space-y-2.5">
          {rows.map(([label, amount]) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">{label}</span>
              <span className={`text-sm ${amount < 0 ? 'text-success' : 'text-text'}`}>
                {amount < 0 ? '-' : ''}₹{Math.abs(Number(amount || 0))}
              </span>
            </div>
          ))}
          <div className="h-px bg-border-light my-1" />
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-text">Total</span>
            <span className="text-lg font-bold text-text">₹{total}</span>
          </div>
        </div>
      )}
    </Card>
  );
}

function FactRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2 min-w-0">
      <Icon className="w-4 h-4 text-text-muted shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-[10px] text-text-muted">{label}</p>
        <p className="text-xs font-medium text-text truncate">{value}</p>
      </div>
    </div>
  );
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
}

export default ReviewBookingPage;
