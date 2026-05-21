import { useNavigate } from 'react-router-dom';
import {
  Package,
  CreditCard,
  Clock3,
  AlertCircle,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import Card from '../../../../components/Card';
import { useCachedQuery } from '../../../../hooks/useCachedQuery';
import { buildCacheKey } from '../../../../store/lib/buildCacheKey';
import { useDriverKitActiveStore } from '../../../../store/driver/useDriverKitStore';
import PayNowButton from './PayNowButton';

/**
 * Compact kit status card for the driver home page.
 *
 * Renders one of four states based on the latest kit order:
 *   - no-order     → "Get your driver kit" CTA (navigates to /driver/kit)
 *   - pending-pay  → "Complete payment" card with inline PayNowButton
 *   - in-review    → "Awaiting admin approval" status (read-only)
 *   - rejected     → "Order rejected" CTA to try another kit
 *
 * The full kit catalog / checkout flow lives on `/driver/kit`. This card never
 * shows kit selection UI — it stays focused on "what does this driver need to
 * do next?".
 *
 * The parent only mounts this card while `canGoOnline === false`, so once the
 * kit is approved the card unmounts automatically and gets out of the way.
 */
const DriverKitHomeCard = ({ onUpdate }) => {
  const navigate = useNavigate();
  const activeKey = buildCacheKey('driver-kit-active', {});
  const { data: activeData, loading, refetch } = useCachedQuery(
    useDriverKitActiveStore,
    activeKey,
    {},
  );

  const orders = Array.isArray(activeData?.orders) ? activeData.orders : [];
  const latestOrder = orders[0];
  const pendingPayment = orders.find((o) => o.paymentStatus === 'pending');
  const approvedOrder = orders.find(
    (o) => o.paymentStatus === 'paid' && o.adminStatus === 'approved',
  );

  const goToKitPage = () => navigate('/driver/kit');
  const goToOrder = () => navigate('/driver/orders');

  const handlePaid = async () => {
    await refetch();
    onUpdate?.();
  };

  /* ---- loading state -------------------------------------------- */
  if (loading && !activeData) {
    return (
      <Card className="flex items-center justify-center py-6">
        <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
      </Card>
    );
  }

  /* ---- already have an approved kit → no kit prompts needed ----- */
  if (approvedOrder) {
    return null;
  }

  /* ---- pending payment (most urgent state) ---------------------- */
  if (pendingPayment) {
    return (
      <Card className="border-l-4 border-l-amber-500 bg-amber-50/40 animate-fade-in-up">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-white border border-amber-200 flex items-center justify-center shrink-0">
            <CreditCard className="w-5 h-5 text-amber-700" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text">Complete your payment</p>
            <p className="text-xs text-text-muted mt-0.5 truncate">
              {pendingPayment.kitSnapshot?.name || 'Driver kit'} ·{' '}
              {pendingPayment.orderNumber}
            </p>
            <p className="text-lg font-bold text-text mt-1">
              ₹{pendingPayment.amount?.toLocaleString('en-IN')}
            </p>
          </div>
        </div>
        <div className="mt-3 space-y-2">
          <PayNowButton
            orderId={pendingPayment._id}
            onPaid={handlePaid}
            label="Pay now"
            className="py-3"
          />
          <button
            type="button"
            onClick={goToOrder}
            className="w-full text-xs font-semibold text-slate-600 py-1.5 hover:text-slate-900"
          >
            View order details
          </button>
        </div>
      </Card>
    );
  }

  /* ---- paid, waiting for admin approval ------------------------- */
  if (latestOrder?.paymentStatus === 'paid' && latestOrder?.adminStatus === 'pending') {
    return (
      <Card className="border-l-4 border-l-emerald-500 bg-emerald-50/30 animate-fade-in-up">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-white border border-emerald-200 flex items-center justify-center shrink-0">
            <Clock3 className="w-5 h-5 text-emerald-700" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text">Awaiting admin approval</p>
            <p className="text-xs text-text-muted mt-0.5 truncate">
              {latestOrder.kitSnapshot?.name || 'Your kit'} · payment received
            </p>
            <p className="text-xs text-text-muted mt-1">
              We'll notify you once it's approved. You'll be able to go online right after.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={goToOrder}
          className="mt-3 w-full text-xs font-semibold text-slate-700 py-2 rounded-xl border border-emerald-200 bg-white hover:bg-emerald-50"
        >
          View order
        </button>
      </Card>
    );
  }

  /* ---- rejected order ------------------------------------------- */
  if (latestOrder?.adminStatus === 'rejected') {
    return (
      <Card className="border-l-4 border-l-rose-500 bg-rose-50/40 animate-fade-in-up">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-white border border-rose-200 flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5 text-rose-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text">Order rejected</p>
            <p className="text-xs text-text-muted mt-1">
              {latestOrder.adminNote ||
                'Your kit order was rejected. Please choose another kit to continue.'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={goToKitPage}
          className="mt-3 w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-text text-white text-sm font-semibold hover:opacity-90"
        >
          <Package className="w-4 h-4" />
          Choose another kit
        </button>
      </Card>
    );
  }

  /* ---- default: no kit purchased yet ---------------------------- */
  return (
    <button
      type="button"
      onClick={goToKitPage}
      className="block w-full text-left animate-fade-in-up focus:outline-none focus:ring-2 focus:ring-primary/40 rounded-2xl"
    >
      <Card className="!p-0 overflow-hidden">
        <div className="p-4 flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text">Get your driver kit</p>
            <p className="text-xs text-text-muted mt-0.5 leading-relaxed">
              A kit is required before you can go online. Browse options and pay
              securely.
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
        </div>
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-500">Mandatory · one-time purchase</span>
          <span className="font-semibold text-primary">Browse kits</span>
        </div>
      </Card>
    </button>
  );
};

export default DriverKitHomeCard;
