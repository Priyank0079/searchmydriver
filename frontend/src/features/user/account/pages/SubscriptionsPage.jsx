import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Sparkles, Loader2, MapPin, ShieldCheck, Star, Clock } from 'lucide-react';
import Card from '../../../../components/Card';
import Button from '../../../../components/Button';
import Badge from '../../../../components/Badge';
import { useUserSubscriptionStore, useUserSubscriptionPlansStore } from '../../../../store/user/useUserPricingStore';
import { useCachedQuery } from '../../../../hooks/useCachedQuery';
import { buildCacheKey } from '../../../../store/lib/buildCacheKey';

const UserSubscriptionsPage = () => {
  const navigate = useNavigate();
  const mySubscription = useUserSubscriptionStore((s) => s.mySubscription);
  const fetchMySubscription = useUserSubscriptionStore((s) => s.fetchMySubscription);

  const plansKey = buildCacheKey('user-subscriptions-active');
  const { data: plansData, loading, error, refetch } = useCachedQuery(useUserSubscriptionPlansStore, plansKey, {});
  const plans = Array.isArray(plansData) ? plansData : [];

  useEffect(() => {
    fetchMySubscription().catch(() => {});
    refetch().catch(() => {});
  }, [fetchMySubscription, refetch]);

  const activePlans = useMemo(
    () => plans.filter((plan) => plan?.isActive !== false),
    [plans],
  );

  if (loading && activePlans.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-dvh bg-bg">
        <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-bg min-h-dvh">
      <Header onBack={() => navigate(-1)} />
      <div className="flex-1 p-4 space-y-4 pb-8">
        {mySubscription?._id && (
          <Card className="border border-primary/20 bg-gradient-to-br from-primary/5 to-white p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="primary">Active plan</Badge>
              <span className="text-xs text-text-muted">{mySubscription.assignmentStatus || 'active'}</span>
            </div>
            <h2 className="text-lg font-bold text-text">{mySubscription.planNameSnapshot || mySubscription.planId?.name || 'Subscription'}</h2>
            <p className="text-sm text-text-secondary">
              Valid till {formatDate(mySubscription.expiryDate)} � {mySubscription.zoneId?.name || 'Your zone'}
            </p>
            <Button className="mt-2" variant="outline" onClick={() => navigate('/user/account/subscription')}>
              View active subscription
            </Button>
          </Card>
        )}

        {error && (
          <Card className="p-4 text-sm text-rose-700 bg-rose-50 border border-rose-200">
            Could not load subscription plans right now.
          </Card>
        )}

        <div className="space-y-3">
          {activePlans.length > 0 ? (
            activePlans.map((plan) => (
              <PlanCard key={plan._id || plan.id || plan.name} plan={plan} />
            ))
          ) : (
            <Card className="p-6 text-center space-y-2">
              <Sparkles className="w-10 h-10 text-text-muted mx-auto" />
              <p className="text-sm font-semibold text-text">No plans available</p>
              <p className="text-sm text-text-secondary">Please check back later or contact support.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

function PlanCard({ plan }) {
  const navigate = useNavigate();
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-bold text-text">{plan.name || 'Plan'}</h3>
            {plan.isPopular && <Badge variant="primary">Popular</Badge>}
          </div>
          <p className="text-sm text-text-secondary mt-1">{plan.description || 'Subscription plan details'}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs uppercase tracking-wide text-text-muted">Price</p>
          <p className="text-lg font-bold text-text">Rs. {Number(plan.price || 0).toLocaleString('en-IN')}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <MiniStat icon={Calendar} label="Duration" value={plan.durationMonths ? `${plan.durationMonths} month${plan.durationMonths === 1 ? '' : 's'}` : 'Flexible'} />
        <MiniStat icon={Clock} label="Hours/day" value={plan.includedHoursPerDay === 0 ? 'Full-time' : `${plan.includedHoursPerDay || '�'} hrs`} />
        <MiniStat icon={MapPin} label="Zone" value={plan.zoneId?.name || 'Any zone'} />
        <MiniStat icon={Star} label="Perks" value={plan.perksCount ? `${plan.perksCount} perk${plan.perksCount === 1 ? '' : 's'}` : 'Standard'} />
      </div>

      {Array.isArray(plan.features) && plan.features.length > 0 && (
        <div className="space-y-1.5">
          {plan.features.slice(0, 4).map((feature) => (
            <div key={feature} className="flex items-center gap-2 text-sm text-text-secondary">
              <ShieldCheck className="w-4 h-4 text-success shrink-0" />
              <span>{feature}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Button fullWidth variant="outline" onClick={() => navigate('/user/account/subscription')}>
          View plan
        </Button>
        <Button fullWidth onClick={() => navigate('/user/book/monthly/type')}>
          Book monthly
        </Button>
      </div>
    </Card>
  );
}

function MiniStat({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-border-light bg-bg px-3 py-3">
      <div className="flex items-center gap-2 text-text-muted text-[11px] uppercase tracking-wide mb-1">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <p className="text-sm font-semibold text-text break-words">{value}</p>
    </div>
  );
}

function Header({ onBack }) {
  return (
    <div className="bg-white px-4 pt-4 pb-4 shadow-sm">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onBack} className="p-2 -ml-2 rounded-xl hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5 text-text" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-text">Subscriptions</h1>
          <p className="text-xs text-text-muted">Browse live plans</p>
        </div>
      </div>
    </div>
  );
}

function formatDate(iso) {
  if (!iso) return '�';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '�';
  }
}

export default UserSubscriptionsPage;
