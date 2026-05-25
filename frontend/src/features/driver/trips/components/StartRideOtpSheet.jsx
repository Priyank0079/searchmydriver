import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Lock, PlayCircle, X } from 'lucide-react';
import Button from '../../../../components/Button';
import PinInput from '../../../../components/inputs/PinInput';
import { PAYMENT_POLICY } from '../../../../constants/bookingStatus';

/**
 * Bottom-sheet that asks the driver to enter the OTP the customer reads out
 * to them at pickup. Submitting calls `useDriverActiveTripStore.startTrip`
 * (passed in as `onSubmit`) which posts to the server with the OTP. On a
 * 4xx (wrong code), the server returns a message we surface inline.
 */
const StartRideOtpSheet = ({ open, onClose, onSubmit, busy }) => {
  const [otp, setOtp] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- canonical reset when sheet closes
    setOtp('');
    setError(null);
  }, [open]);

  const handleConfirm = async () => {
    if (busy) return;
    if (otp.length !== PAYMENT_POLICY.RIDE_OTP_LENGTH) {
      setError(`Enter the ${PAYMENT_POLICY.RIDE_OTP_LENGTH}-digit code`);
      return;
    }
    setError(null);
    try {
      await onSubmit(otp);
      toast.success('Trip started');
      onClose?.();
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Could not start trip';
      setError(message);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/45"
        onClick={busy ? undefined : onClose}
      />
      <div className="relative w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 pb-6 animate-slide-up">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="w-10 h-10 rounded-2xl bg-primary/15 flex items-center justify-center mb-2">
              <Lock className="w-5 h-5 text-primary-dark" />
            </div>
            <h2 className="text-lg font-bold text-text">Verify start OTP</h2>
            <p className="text-xs text-text-muted mt-0.5">
              Ask the customer for their {PAYMENT_POLICY.RIDE_OTP_LENGTH}-digit ride code and type it in here.
            </p>
          </div>
          {!busy && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-gray-100 -mt-1 -mr-1"
              aria-label="Close"
            >
              <X className="w-4 h-4 text-text-muted" />
            </button>
          )}
        </div>

        <div className="my-3">
          <PinInput
            value={otp}
            onChange={setOtp}
            length={PAYMENT_POLICY.RIDE_OTP_LENGTH}
            autoFocus
            disabled={busy}
            error={!!error}
          />
        </div>
        {error && (
          <p className="text-center text-xs font-medium text-danger mt-1">{error}</p>
        )}

        <Button
          fullWidth
          variant="driver"
          icon={PlayCircle}
          loading={busy}
          onClick={handleConfirm}
          className="mt-5"
        >
          Start trip
        </Button>
      </div>
    </div>
  );
};

export default StartRideOtpSheet;
