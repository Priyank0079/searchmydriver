import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Package, Car, Wallet } from 'lucide-react';
import Card from '../../../../components/Card';
import { useCachedQuery } from '../../../../hooks/useCachedQuery';
import { buildCacheKey } from '../../../../store/lib/buildCacheKey';
import { useDriverPaymentHistoryStore } from '../../../../store/driver/useDriverHistoryStore';
import { PAYMENT_STATUS_LABELS } from '../../../../constants/kitStatus';
import { PAYMENT_TYPE_LABELS } from '../../../../constants/paymentHistory';

const TYPE_ICONS = {
  kit: Package,
  trip: Car,
  withdrawal: Wallet,
};

const statusColor = (status) => {
  if (status === 'paid') return 'bg-emerald-100 text-emerald-800';
  if (status === 'failed') return 'bg-red-100 text-red-800';
  if (status === 'pending') return 'bg-amber-100 text-amber-800';
  return 'bg-slate-100 text-slate-600';
};

const DriverPaymentHistoryPage = () => {
  const navigate = useNavigate();
  const cacheKey = buildCacheKey('driver-payment-history', {});

  const { data, loading } = useCachedQuery(useDriverPaymentHistoryStore, cacheKey, {});
  const payments = useMemo(
    () => (Array.isArray(data?.payments) ? data.payments : []),
    [data?.payments],
  );
  const summary = data?.summary ?? {};

  return (
    <div className="flex-1 flex flex-col bg-bg min-h-dvh">
      <div className="bg-white px-4 pt-4 pb-4 shadow-sm flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-2 -ml-2">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg font-bold">Payment history</h1>
          <p className="text-xs text-text-muted">Kits, trips, and payouts</p>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-3">
        {summary.total > 0 && (
          <p className="text-xs text-text-muted px-1">
            {summary.total} transaction{summary.total === 1 ? '' : 's'}
            {summary.kit > 0 && ` · ${summary.kit} kit`}
            {summary.trip > 0 && ` · ${summary.trip} trip`}
          </p>
        )}

        {loading && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        )}

        {!loading && payments.length === 0 && (
          <Card className="text-center py-8">
            <p className="text-sm text-text-muted">No payments yet</p>
            <p className="text-xs text-text-muted mt-2">
              Kit purchases and trip earnings will show up here
            </p>
          </Card>
        )}

        {!loading &&
          payments.map((payment) => {
            const Icon = TYPE_ICONS[payment.type] || Package;
            return (
              <Card key={`${payment.id}-${payment.createdAt}`}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-text-secondary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm text-text">{payment.title}</p>
                        <p className="text-[10px] text-text-muted mt-0.5">
                          {PAYMENT_TYPE_LABELS[payment.type] || payment.type}
                          {payment.orderNumber && ` · ${payment.orderNumber}`}
                        </p>
                      </div>
                      <p className="font-bold text-primary text-sm shrink-0">
                        ₹{payment.amount?.toLocaleString('en-IN')}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${statusColor(payment.status)}`}
                      >
                        {PAYMENT_STATUS_LABELS[payment.status] || payment.status}
                      </span>
                    </div>
                    <p className="text-xs text-text-muted mt-2">
                      {new Date(payment.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
      </div>
    </div>
  );
};

export default DriverPaymentHistoryPage;
