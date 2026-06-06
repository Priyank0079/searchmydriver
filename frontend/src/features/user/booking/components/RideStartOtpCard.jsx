import { ShieldCheck } from 'lucide-react';
import Card from '../../../../components/Card';

/**
 * Card the customer sees once the driver marks "arrived" — displays the
 * OTP they need to read out so the driver can start the ride.
 */
const RideStartOtpCard = ({ code }) => {
  if (!code) return null;
  const digits = String(code).split('');

  return (
    <Card className="bg-amber-50/70 border-amber-200">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
          <ShieldCheck className="w-5 h-5 text-amber-700" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-amber-700 font-bold">
            Ride start OTP
          </p>
          <p className="text-xs text-amber-900/80 leading-snug">
            Read this code out to your driver to start the trip.
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-2 mt-4 justify-center">
        {digits.map((digit, idx) => (
          <span
            key={`otp-${idx}`}
            className="inline-flex items-center justify-center w-12 h-14 text-2xl font-bold text-amber-900 bg-white rounded-xl border border-amber-300 shadow-sm"
          >
            {digit}
          </span>
        ))}
      </div>
    </Card>
  );
};

export default RideStartOtpCard;
