import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  Check,
  Loader2,
  MapPin,
  Sparkles,
  Star,
  UserCheck,
  Calendar,
} from 'lucide-react';
import Card from '../../../../components/Card';
import Button from '../../../../components/Button';
import Drawer from '../../../../components/Drawer';
import { useCachedQuery } from '../../../../hooks/useCachedQuery';
import { buildCacheKey } from '../../../../store/lib/buildCacheKey';
import {
  useUserSubscriptionPlansStore,
  useUserSubscriptionStore,
} from '../../../../store/user/useUserPricingStore';
import { SUBSCRIPTION_BANNER } from '../../home/constants/serviceCatalog';
import { SUBSCRIPTION_ASSIGNMENT_STATUS } from '../../../../constants/serviceTypes';
import useUserAuthStore from '../../../../store/useUserAuthStore';
import { useRazorpayCheckout } from '../../../../hooks/useRazorpayCheckout';
import api from '../../../../utils/api';
import { calculateSubscriptionCheckout, formatCurrency } from '../../../../utils/fareCalculator';

const SubscriptionsPage = () => {
  const navigate = useNavigate();
  const user = useUserAuthStore((s) => s.user);

  const { data, loading } = useCachedQuery(
    useUserSubscriptionPlansStore,
    buildCacheKey('user-subscriptions-active'),
  );

  const mySubscription = useUserSubscriptionStore((s) => s.mySubscription);
  const fetchMySubscription = useUserSubscriptionStore((s) => s.fetchMySubscription);
  const createPurchaseOrder = useUserSubscriptionStore((s) => s.createPurchaseOrder);
  const verifyPurchase = useUserSubscriptionStore((s) => s.verifyPurchase);
  const purchaseLoading = useUserSubscriptionStore((s) => s.purchaseLoading);
  const subscriptionLoading = useUserSubscriptionStore((s) => s.loading);

  const { openCheckout, loading: checkoutLoading } = useRazorpayCheckout();

  const [zones, setZones] = useState([]);
  const [zonesLoading, setZonesLoading] = useState(true);
  const [zonePickerPlan, setZonePickerPlan] = useState(null);
  const [selectedZoneId, setSelectedZoneId] = useState('');
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    fetchMySubscription().catch(() => {});
  }, [fetchMySubscription]);

  useEffect(() => {
    let cancelled = false;
    setZonesLoading(true);
    api
      .get('/common/zones')
      .then((res) => {
        if (!cancelled) {
          const list = res?.data?.data || [];
          setZones(Array.isArray(list) ? list : []);
        }
      })
      .catch(() => {
        if (!cancelled) setZones([]);
      })
      .finally(() => {
        if (!cancelled) setZonesLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const plans = useMemo(() => {
    const list = Array.isArray(data) ? data : [];
    return list
      .filter((p) => p?.isActive !== false)
      .slice()
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [data]);

  const hasActiveSubscription = Boolean(mySubscription?._id);

  const handleSubscribeClick = (plan) => {
    if (hasActiveSubscription) {
      toast.error('You already have an active subscription');
      return;
    }
    if (!zones.length) {
      toast.error('No service zones available yet. Please try again later.');
      return;
    }
    setSelectedZoneId(zones[0]?._id || '');
    setZonePickerPlan(plan);
  };

  const handleConfirmPurchase = useCallback(async () => {
    if (!zonePickerPlan || !selectedZoneId || subscribing || purchaseLoading || checkoutLoading) {
      return;
    }
    setSubscribing(true);
    try {
      const order = await createPurchaseOrder(zonePickerPlan._id, selectedZoneId);
      if (!order?.orderId) {
        toast.error('Payments are not configured. Please try again later.');
        return;
      }

      await openCheckout({
        razorpay: {
          keyId: order.keyId,
          orderId: order.orderId,
          amount: order.amount,
          currency: order.currency,
          name: order.name,
          description: order.description,
        },
        driver: {
          name: order.prefill?.name || user?.name,
          email: order.prefill?.email || user?.email,
          phone: order.prefill?.contact || user?.phone_no,
        },
        onSuccess: async (response) => {
          await verifyPurchase({
            orderId: response.razorpay_order_id,
            paymentId: response.razorpay_payment_id,
            signature: response.razorpay_signature,
          });
        },
      });

      toast.success('Subscription activated! We will assign your dedicated driver soon.');
      setZonePickerPlan(null);
    } catch (err) {
      if (err?.message !== 'Payment cancelled') {
        toast.error(err?.response?.data?.message || err?.message || 'Could not complete subscription');
      }
    } finally {
      setSubscribing(false);
    }
  }, [
    zonePickerPlan,
    selectedZoneId,
    subscribing,
    purchaseLoading,
    checkoutLoading,
    createPurchaseOrder,
    openCheckout,
    verifyPurchase,
    user,
  ]);

  return (
    <div className="flex-1 flex flex-col bg-bg min-h-dvh">
      <div className="bg-white px-4 pt-4 pb-4 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl hover:bg-gray-100">
            <ArrowLeft className="w-5 h-5 text-text" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-text">Subscriptions</h1>
            <p className="text-xs text-text-muted">A driver of your own, on your schedule.</p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-4">
        <HeroCard />

        {(subscriptionLoading || mySubscription) && (
          <ActiveSubscriptionCard
            subscription={mySubscription}
            loading={subscriptionLoading}
            onOpen={() => navigate('/user/account/subscription')}
          />
        )}

        {loading && !plans.length ? (
          <div className="flex items-center justify-center py-16 text-text-muted">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : plans.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-3">
            {plans.map((plan, idx) => (
              <PlanCard
                key={plan._id}
                plan={plan}
                index={idx}
                disabled={hasActiveSubscription}
                onSubscribe={() => handleSubscribeClick(plan)}
              />
            ))}
          </div>
        )}
      </div>

      <Drawer
        isOpen={Boolean(zonePickerPlan)}
        onClose={() => !subscribing && setZonePickerPlan(null)}
        header={(
          <div className="px-5 py-4">
            <h2 className="text-lg font-bold text-text">Choose your city</h2>
            <p className="text-xs text-text-muted mt-0.5">
              We assign a dedicated driver based on your service zone.
            </p>
          </div>
        )}
      >
        <div className="p-5 space-y-4">
          {zonesLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
            </div>
          ) : (
            <div className="space-y-2">
              {zones.map((zone) => {
                const active = String(selectedZoneId) === String(zone._id);
                return (
                  <button
                    key={zone._id}
                    type="button"
                    onClick={() => setSelectedZoneId(zone._id)}
                    className={`w-full flex items-center gap-3 p-4 rounded-2xl border text-left transition-all ${
                      active
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                        : 'border-gray-200 bg-white hover:border-primary/30'
                    }`}
                  >
                    <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      active ? 'bg-primary/15 text-primary' : 'bg-gray-100 text-text-muted'
                    }`}
                    >
                      <MapPin className="w-4 h-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-text">{zone.name}</span>
                      {zone.city && (
                        <span className="block text-xs text-text-muted mt-0.5">{zone.city}</span>
                      )}
                    </span>
                    {active && <Check className="w-4 h-4 text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}

          {zonePickerPlan && (
            <div className="rounded-2xl bg-gray-50 p-4 text-sm space-y-1.5">
              <p className="font-bold text-text">{zonePickerPlan.name}</p>
              <CheckoutLines plan={zonePickerPlan} />
            </div>
          )}

          <Button
            fullWidth
            disabled={!selectedZoneId || subscribing || purchaseLoading || checkoutLoading || zonesLoading}
            onClick={handleConfirmPurchase}
          >
            {subscribing || purchaseLoading || checkoutLoading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing…
              </span>
            ) : (
              `Pay ${formatCurrency(calculateSubscriptionCheckout(zonePickerPlan || {}).totalPayable)} & subscribe`
            )}
          </Button>
        </div>
      </Drawer>
    </div>
  );
};

function HeroCard() {
  return (
    <div
      className="
        relative overflow-hidden rounded-3xl p-5
        bg-gradient-to-br from-[#1F1B2E] via-[#2D2640] to-[#4F3F89] shadow-lg
      "
    >
      <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-primary/10 blur-2xl pointer-events-none" />
      <div className="absolute right-4 top-1/2 -translate-y-1/2 w-44 h-44 rounded-full bg-primary/15 blur-2xl pointer-events-none" />

      <div className="relative flex items-center gap-2 -mr-2 min-h-[180px]">
        <div className="flex-1 min-w-0">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/15 border border-primary/30 text-[10px] font-bold uppercase tracking-wider text-primary">
            <Sparkles className="w-3 h-3" />
            Premium
          </span>
          <h2 className="text-white text-lg font-extrabold mt-3 leading-tight">
            {SUBSCRIPTION_BANNER.title}
          </h2>
          <p className="text-white/70 text-xs mt-1">{SUBSCRIPTION_BANNER.tagline}</p>
        </div>
        <div className="w-40 sm:w-44 shrink-0 self-stretch flex items-center justify-end">
          <img
            src={SUBSCRIPTION_BANNER.imageSrc}
            alt="Premium"
            className="w-full max-h-44 object-contain object-right drop-shadow-2xl"
          />
        </div>
      </div>
    </div>
  );
}

function ActiveSubscriptionCard({ subscription, loading, onOpen }) {
  if (loading && !subscription) {
    return (
      <Card className="flex items-center justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
      </Card>
    );
  }
  if (!subscription) return null;

  const planName = subscription.planNameSnapshot || subscription.planId?.name || 'Subscription';
  const zoneName = subscription.zoneId?.name || 'Your zone';
  const assigned = subscription.assignmentStatus === SUBSCRIPTION_ASSIGNMENT_STATUS.ASSIGNED;
  const expiry = subscription.expiryDate
    ? new Date(subscription.expiryDate).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
    : '—';

  return (
    <button type="button" onClick={onOpen} className="w-full text-left">
    <Card className="border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
          <UserCheck className="w-5 h-5 text-primary" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wide text-primary">My subscription</p>
          <h3 className="text-base font-extrabold text-text mt-1">{planName}</h3>
          <p className="text-xs text-text-muted mt-1">{zoneName}</p>
          <div className="flex flex-wrap gap-3 mt-3 text-xs text-text-secondary">
            <span className="inline-flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              Valid till {expiry}
            </span>
            <span className={`inline-flex items-center gap-1 font-semibold ${
              assigned ? 'text-success' : 'text-amber-600'
            }`}
            >
              {assigned
                ? `Driver: ${subscription.assignedDriverId?.name || 'Assigned'}`
                : 'Driver assignment pending'}
            </span>
          </div>
        </div>
      </div>
    </Card>
    </button>
  );
}

function PlanCard({ plan, index, disabled, onSubscribe }) {
  const isPercentage = plan.bookingDiscountType === 'percentage';
  const isFullTime = plan.includedHoursPerDay === 0;
  const checkout = calculateSubscriptionCheckout(plan);

  return (
    <Card
      className="animate-fade-in-up"
      style={{ animationDelay: `${0.1 + index * 0.06}s` }}
      padding="p-0"
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-extrabold text-text">{plan.name}</h3>
            {plan.description && (
              <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{plan.description}</p>
            )}
          </div>
          {index === 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/15 text-[10px] font-bold text-primary-dark uppercase tracking-wide shrink-0">
              <Star className="w-3 h-3 fill-current" />
              Popular
            </span>
          )}
        </div>

        <div className="flex items-baseline gap-2 mt-3">
          <span className="text-2xl font-extrabold text-text">{formatCurrency(checkout.totalPayable)}</span>
          <span className="text-xs text-text-muted">
            / {plan.durationMonths === 1 ? 'month' : `${plan.durationMonths} months`}
          </span>
        </div>
        {checkout.totalPayable !== checkout.basePrice && (
          <p className="text-[11px] text-text-muted mt-1">
            Base {formatCurrency(checkout.basePrice)} + fees & GST
          </p>
        )}

        <ul className="mt-4 space-y-2">
          <PerkRow
            label={
              isFullTime
                ? 'Full-time dedicated driver'
                : `${plan.includedHoursPerDay} hrs/day with your dedicated driver`
            }
          />
          {plan.bookingDiscountValue > 0 && (
            <PerkRow
              label={
                isPercentage
                  ? `${plan.bookingDiscountValue}% off extra bookings${plan.bookingDiscountMinAmount > 0 ? ` above ${formatCurrency(plan.bookingDiscountMinAmount)}` : ''}`
                  : `${formatCurrency(plan.bookingDiscountValue)} off extra bookings${plan.bookingDiscountMinAmount > 0 ? ` above ${formatCurrency(plan.bookingDiscountMinAmount)}` : ''}`
              }
            />
          )}
          {(plan.features || []).map((feature) => (
            <PerkRow key={feature} label={feature} />
          ))}
        </ul>

        <Button fullWidth className="mt-5" disabled={disabled} onClick={onSubscribe}>
          {disabled ? 'Already subscribed' : 'Subscribe now'}
        </Button>
      </div>
    </Card>
  );
}

function PerkRow({ label }) {
  return (
    <li className="flex items-start gap-2 text-sm text-text-secondary">
      <span className="w-5 h-5 rounded-full bg-success/15 flex items-center justify-center mt-0.5 shrink-0">
        <Check className="w-3 h-3 text-success" />
      </span>
      <span>{label}</span>
    </li>
  );
}

function CheckoutLines({ plan }) {
  const c = calculateSubscriptionCheckout(plan);
  return (
    <>
      <div className="flex justify-between text-text-secondary">
        <span>Base</span>
        <span>{formatCurrency(c.basePrice)}</span>
      </div>
      {c.serviceCharge > 0 && (
        <div className="flex justify-between text-text-secondary">
          <span>Service charge ({c.serviceChargePercent}%)</span>
          <span>{formatCurrency(c.serviceCharge)}</span>
        </div>
      )}
      {c.gstAmount > 0 && (
        <div className="flex justify-between text-text-secondary">
          <span>GST ({c.gstPercent}%)</span>
          <span>{formatCurrency(c.gstAmount)}</span>
        </div>
      )}
      <div className="flex justify-between font-bold text-text pt-1 border-t border-border-light">
        <span>Total</span>
        <span>{formatCurrency(c.totalPayable)}</span>
      </div>
    </>
  );
}

function EmptyState() {
  return (
    <Card className="text-center py-10">
      <p className="text-sm text-text-muted">
        We don&apos;t have any subscription plans listed yet. Check back soon!
      </p>
    </Card>
  );
}

export default SubscriptionsPage;
