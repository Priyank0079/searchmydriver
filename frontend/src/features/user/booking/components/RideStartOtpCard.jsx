import { ShieldCheck } from 'lucide-react';
import Card from '../../../../components/Card';

/**
 * Card the customer sees once the driver marks "arrived" — displays the
 * OTP they need to read out so the driver can start the ride. Designed as
 * a presentational sub-component so any future status that surfaces the
 * OTP can reuse it.
 */
const RideStartOtpCard = ({ code }) => {
  if (!code) return null;
  const digits = String(code).split('');
  return (
    <Card className="bg-amber-50/70 border-amber-100">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
          <ShieldCheck className="w-5 h-5 text-amber-700" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wide text-amber-700 font-semibold">
            Share this code with the driver
          </p>
          <p className="text-[12px] text-text-secondary mt-0.5 leading-snug">
            Your driver needs this code to start the ride. It changes for every booking.
          </p>
          <div className="flex items-center gap-2 mt-3">
            {digits.map((digit, idx) => (
              <span
                key={`otp-${idx}`}
                className="inline-flex items-center justify-center w-10 h-12 text-xl font-bold text-amber-900 bg-white rounded-xl border border-amber-200 shadow-sm"
              >
                {digit}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
};

export default RideStartOtpCard;
