import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Loader2,
  MapPin,
  Sparkles,
  UserCheck,
  IndianRupee,
  Percent,
  Clock,
} from 'lucide-react';
import Card from '../../../../components/Card';
import Button from '../../../../components/Button';
import Badge from '../../../../components/Badge';
import { useUserSubscriptionStore } from '../../../../store/user/useUserPricingStore';
import { SUBSCRIPTION_ASSIGNMENT_STATUS } from '../../../../constants/serviceTypes';
import { formatCurrency } from '../../../../utils/fareCalculator';

const MySubscriptionPage = () => {
  const navigate = useNavigate();
  const mySubscription = useUserSubscriptionStore((s) => s.mySubscription);
  const loading = useUserSubscriptionStore((s) => s.loading);
  const fetchMySubscription = useUserSubscriptionStore((s) => s.fetchMySubscription);

  useEffect(() => {
    fetchMySubscription().catch(() => {});
  }, [fetchMySubscription]);

  if (loading && !mySubscription) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-dvh bg-bg">
        <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
      </div>
    );
  }

  if (!mySubscription?._id) {
    return (
      <div className="flex-1 flex flex-col bg-bg min-h-dvh">
        <Header onBack={() => navigate(-1)} />
        <div className="flex-1 p-4">
          <Card className="text-center py-12">
            <Sparkles className="w-10 h-10 text-text-muted mx-auto mb-3" />
            <p className="text-sm text-text-muted">You don&apos;t have an active subscription.</p>
            <Button className="mt-5" onClick={() => navigate('/user/subscriptions')}>
              Browse plans
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  const sub = mySubscription;
  const assigned = sub.assignmentStatus === SUBSCRIPTION_ASSIGNMENT_STATUS.ASSIGNED;
  const isFullTime = sub.includedHoursPerDay === 0;
  const fmt = (d) =>
    d
      ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : '—';

  return (
    <div className="flex-1 flex flex-col bg-bg min-h-dvh">
      <Header onBack={() => navigate(-1)} />

      <div className="flex-1 p-4 space-y-4 pb-8">
        <Card className="border border-primary/20 bg-gradient-to-br from-primary/5 to-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Badge variant="primary">Active</Badge>
              <h2 className="text-xl font-extrabold text-text mt-2">
                {sub.planNameSnapshot || sub.planId?.name || 'Subscription'}
              </h2>
              <p className="text-sm text-text-muted mt-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {sub.zoneId?.name || 'Your zone'}
                {sub.zoneId?.city ? ` · ${sub.zoneId.city}` : ''}
              </p>
            </div>
            <Sparkles className="w-8 h-8 text-primary shrink-0" />
          </div>

          <div className="grid grid-cols-2 gap-3 mt-5">
            <InfoTile icon={Calendar} label="Started" value={fmt(sub.startDate)} />
            <InfoTile icon={Calendar} label="Valid till" value={fmt(sub.expiryDate)} />
            <InfoTile
              icon={Clock}
              label="Driver hours"
              value={
                isFullTime
                  ? 'Full-time'
                  : `${sub.includedHoursPerDay} hrs/day`
              }
            />
            <InfoTile icon={IndianRupee} label="Paid" value={formatCurrency(sub.amount)} />
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-bold text-text mb-3">Payment breakdown</h3>
          <BreakdownRow label="Base price" value={formatCurrency(sub.basePrice ?? sub.amount)} />
          {sub.serviceCharge > 0 && (
            <BreakdownRow
              label={`Service charge (${sub.serviceChargePercent || 0}%)`}
              value={formatCurrency(sub.serviceCharge)}
            />
          )}
          {sub.gstAmount > 0 && (
            <BreakdownRow
              label={`GST (${sub.gstPercent || 0}%)`}
              value={formatCurrency(sub.gstAmount)}
            />
          )}
          <BreakdownRow label="Total paid" value={formatCurrency(sub.amount)} bold />
        </Card>

        {(sub.bookingDiscountValue > 0) && (
          <Card>
            <h3 className="text-sm font-bold text-text mb-2 flex items-center gap-2">
              <Percent className="w-4 h-4 text-primary" />
              Extra booking discount
            </h3>
            <p className="text-sm text-text-secondary">
              {sub.bookingDiscountType === 'percentage'
                ? `${sub.bookingDiscountValue}% off`
                : `${formatCurrency(sub.bookingDiscountValue)} off`}
              {' '}on hourly & outstation bookings
              {(sub.bookingDiscountMinAmount || 0) > 0 && (
                <> when fare is {formatCurrency(sub.bookingDiscountMinAmount)} or more</>
              )}
            </p>
          </Card>
        )}

        <Card>
          <h3 className="text-sm font-bold text-text mb-3 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-primary" />
            Dedicated driver
          </h3>
          {assigned && sub.assignedDriver ? (
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold">
                {(sub.assignedDriver.name || 'D').charAt(0)}
              </div>
              <div>
                <p className="font-semibold text-text">{sub.assignedDriver.name}</p>
                <p className="text-xs text-text-muted">{sub.assignedDriver.phone || '—'}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-amber-700 bg-amber-50 rounded-xl px-3 py-2">
              Your dedicated driver is being assigned. Our team will match you shortly.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
};

function Header({ onBack }) {
  return (
    <div className="bg-white px-4 pt-4 pb-4 shadow-sm">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 -ml-2 rounded-xl hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5 text-text" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-text">My Subscription</h1>
          <p className="text-xs text-text-muted">Plan details & benefits</p>
        </div>
      </div>
    </div>
  );
}

function InfoTile({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl bg-gray-50 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wide text-text-muted font-semibold flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {label}
      </p>
      <p className="text-sm font-bold text-text mt-1">{value}</p>
    </div>
  );
}

function BreakdownRow({ label, value, bold }) {
  return (
    <div className={`flex justify-between text-sm py-1.5 ${bold ? 'font-bold text-text border-t border-border-light mt-1 pt-2' : 'text-text-secondary'}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export default MySubscriptionPage;
