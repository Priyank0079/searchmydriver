import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../../../components/Card';
import Button from '../../../../components/Button';
import {
  Loader2,
  AlertCircle,
  TrendingUp,
  Wallet,
  Inbox,
  Car,
  XCircle,
  AlertOctagon,
} from 'lucide-react';
import { useCachedQuery } from '../../../../hooks/useCachedQuery';
import { buildCacheKey } from '../../../../store/lib/buildCacheKey';
import {
  useDriverEarningsStore,
  useDriverEarningsLedgerStore,
} from '../../../../store/driver/useDriverTripsStore';
import { formatCurrency } from '../../../../utils/formatters';
import DriverScreenShell from '../../components/DriverScreenShell';

const EMPTY = { earnings: 0, trips: 0 };

/**
 * Driver earnings dashboard.
 *
 *   Sticky header  → title + this-week hero
 *   Scrolling body → bar chart · today/week/month stats · payout CTA · recent payouts
 *
 * No mock fallbacks: if the API hasn't loaded yet we show a skeleton; if
 * it errors we surface a retry. Never fake numbers in an earnings UI.
 */
const EarningsPage = () => {
  const navigate = useNavigate();
  const cacheKey = buildCacheKey('driver-earnings', {});
  const { data, loading, error, refetch } = useCachedQuery(
    useDriverEarningsStore,
    cacheKey,
    {},
  );

  // Ledger: paginated feed of every earning (trip + cancellation share).
  const ledgerRows = useDriverEarningsLedgerStore((s) => s.rows);
  const ledgerTotals = useDriverEarningsLedgerStore((s) => s.totals);
  const ledgerPage = useDriverEarningsLedgerStore((s) => s.page);
  const ledgerLimit = useDriverEarningsLedgerStore((s) => s.limit);
  const ledgerHasMore = useDriverEarningsLedgerStore((s) => s.hasMore);
  const ledgerLoading = useDriverEarningsLedgerStore((s) => s.loading);
  const ledgerFetched = useDriverEarningsLedgerStore((s) => s.fetched);
  const fetchLedger = useDriverEarningsLedgerStore((s) => s.fetch);

  useEffect(() => {
    fetchLedger({ page: 1, limit: 20 }).catch(() => {});
  }, [fetchLedger]);

  const summary = data?.summary || {};
  const today = summary.today || EMPTY;
  const week = summary.week || EMPTY;
  const month = summary.month || EMPTY;
  const buckets = data?.daily?.buckets || [];
  const peak = data?.daily?.peak || 0;

  const stats = useMemo(
    () => [
      { label: 'Today', amount: formatCurrency(today.earnings), trips: today.trips },
      { label: 'This Week', amount: formatCurrency(week.earnings), trips: week.trips },
      { label: 'This Month', amount: formatCurrency(month.earnings), trips: month.trips },
    ],
    [today, week, month],
  );

  const onLoadMore = () => {
    if (ledgerLoading || !ledgerHasMore) return;
    fetchLedger({ page: ledgerPage + 1, limit: ledgerLimit, append: true }).catch(
      () => {},
    );
  };

  return (
    <DriverScreenShell
      header={
        <header className="bg-dark px-4 pt-4 pb-5 rounded-b-3xl">
          <h1 className="text-lg font-bold text-white mb-3">Earnings</h1>
          <Card className="!bg-white/10 backdrop-blur-sm !shadow-none border-0">
            <p className="text-xs text-white/70 uppercase tracking-wide font-semibold">
              This Week
            </p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-bold text-white">
                {formatCurrency(week.earnings)}
              </span>
              {week.trips > 0 && (
                <span className="text-xs text-white/70">
                  · {week.trips} trip{week.trips === 1 ? '' : 's'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-xs text-white/80">
              <TrendingUp className="w-3.5 h-3.5" />
              {peak > 0 ? (
                <span>Best day: {formatCurrency(peak)}</span>
              ) : (
                <span>Earn now to see your weekly trend</span>
              )}
            </div>
          </Card>
        </header>
      }
      bodyClassName="p-4 -mt-2 pb-8 space-y-4"
    >
      {loading && !data && (
        <Card className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
        </Card>
      )}

      {error && (
        <Card className="border-l-4 border-l-danger">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-danger shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-text">Couldn't load earnings</p>
              <p className="text-xs text-text-muted mt-0.5">{error}</p>
              <Button
                size="sm"
                variant="ghost"
                className="mt-2"
                onClick={() => refetch()}
              >
                Retry
              </Button>
            </div>
          </div>
        </Card>
      )}

      {!!data && (
        <>
          <Card>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-text-muted font-semibold uppercase tracking-wide">
                Last 7 days
              </p>
              {peak > 0 && (
                <span className="text-[11px] text-text-muted">
                  Peak {formatCurrency(peak)}
                </span>
              )}
            </div>
            <EarningsBarChart buckets={buckets} peak={peak} />
          </Card>

          <Card padding="p-0">
            <ul className="divide-y divide-border-light">
              {stats.map((stat) => (
                <li
                  key={stat.label}
                  className="flex items-center justify-between px-4 py-3.5"
                >
                  <div>
                    <p className="text-xs text-text-muted font-semibold uppercase tracking-wide">
                      {stat.label}
                    </p>
                    <p className="text-[11px] text-text-muted mt-0.5">
                      {stat.trips} trip{stat.trips === 1 ? '' : 's'}
                    </p>
                  </div>
                  <p className="text-base font-bold text-text">{stat.amount}</p>
                </li>
              ))}
            </ul>
          </Card>

          <EarningsBreakdown totals={ledgerTotals} />

          <Button
            fullWidth
            variant="driver"
            icon={Wallet}
            onClick={() => navigate('/driver/payments')}
          >
            View payout history
          </Button>

          <AllEarningsFeed
            rows={ledgerRows}
            loading={ledgerLoading}
            fetched={ledgerFetched}
            hasMore={ledgerHasMore}
            onLoadMore={onLoadMore}
          />
        </>
      )}
    </DriverScreenShell>
  );
};

/* ------------------------------------------------------------------ */
/* Earnings breakdown (trips vs. cancellation shares)                  */
/* ------------------------------------------------------------------ */

function EarningsBreakdown({ totals }) {
  const trip = Number(totals?.tripEarnings) || 0;
  const cancellation = Number(totals?.cancellationEarnings) || 0;
  const penalty = Number(totals?.penaltyDeductions) || 0;
  const netEarnings = Number(totals?.netEarnings) || trip + cancellation - penalty;
  const lifetimeCredit = trip + cancellation;
  if (lifetimeCredit <= 0 && penalty <= 0) return null;
  return (
    <Card padding="p-0">
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
        <p className="text-xs text-text-muted font-semibold uppercase tracking-wide">
          Net earnings
        </p>
        <p
          className={`text-base font-bold ${
            netEarnings < 0 ? 'text-rose-700' : 'text-text'
          }`}
        >
          {formatCurrency(netEarnings)}
        </p>
      </div>
      <ul className="divide-y divide-border-light">
        <BreakdownRow
          icon={Car}
          tone="text-primary bg-primary/10"
          label="Trip payouts"
          subLabel={`${Number(totals?.tripCount) || 0} trip${
            (totals?.tripCount || 0) === 1 ? '' : 's'
          }`}
          amount={trip}
          direction="credit"
        />
        <BreakdownRow
          icon={XCircle}
          tone="text-amber-600 bg-amber-100"
          label="Cancellation shares"
          subLabel={`${Number(totals?.cancellationCount) || 0} cancel${
            (totals?.cancellationCount || 0) === 1 ? '' : 's'
          }`}
          amount={cancellation}
          direction="credit"
        />
        {penalty > 0 && (
          <BreakdownRow
            icon={AlertOctagon}
            tone="text-rose-700 bg-rose-100"
            label="Cancel penalties"
            subLabel={`${Number(totals?.penaltyCount) || 0} penalt${
              (totals?.penaltyCount || 0) === 1 ? 'y' : 'ies'
            }`}
            amount={penalty}
            direction="debit"
          />
        )}
      </ul>
    </Card>
  );
}

function BreakdownRow({ icon: Icon, tone, label, subLabel, amount, direction = 'credit' }) {
  const isDebit = direction === 'debit';
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div
        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${tone}`}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text truncate">{label}</p>
        <p className="text-[11px] text-text-muted">{subLabel}</p>
      </div>
      <p
        className={`text-sm font-bold shrink-0 ${
          isDebit ? 'text-rose-700' : 'text-text'
        }`}
      >
        {isDebit ? '\u2212 ' : ''}
        {formatCurrency(amount)}
      </p>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* All-earnings feed (paginated ledger)                                */
/* ------------------------------------------------------------------ */

/**
 * Unified, paginated feed of every earning the driver has ever
 * received: trip payouts AND cancellation shares (when a user cancels
 * and the admin policy splits the fee with the driver).
 *
 * Pagination is "Load more" — same UX as the user wallet. Replacing the
 * old "last 10 completed trips" tile so drivers can scroll their full
 * history without leaving the page.
 */
function AllEarningsFeed({ rows, loading, fetched, hasMore, onLoadMore }) {
  const isEmpty = fetched && rows.length === 0;
  return (
    <section>
      <div className="flex items-center justify-between mb-2 px-1">
        <p className="text-xs uppercase tracking-wide font-semibold text-text-muted">
          All earnings
        </p>
        {loading && rows.length > 0 && (
          <Loader2 className="w-4 h-4 animate-spin text-text-muted" />
        )}
      </div>

      {!fetched && loading ? (
        <Card>
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
          </div>
        </Card>
      ) : isEmpty ? (
        <Card className="flex flex-col items-center justify-center py-10 text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
            <Inbox className="w-6 h-6 text-primary" />
          </div>
          <p className="text-sm font-semibold text-text">No earnings yet</p>
          <p className="text-xs text-text-muted mt-1 max-w-[240px]">
            Completed trips and your share of cancellation fees show up here.
          </p>
        </Card>
      ) : (
        <>
          <Card padding="p-0" className="divide-y divide-border-light overflow-hidden">
            {rows.map((row) => (
              <EarningsLedgerRow key={row._id} row={row} />
            ))}
          </Card>
          {hasMore && (
            <Button
              fullWidth
              variant="ghost"
              size="sm"
              className="mt-3"
              loading={loading}
              onClick={onLoadMore}
            >
              Load more
            </Button>
          )}
        </>
      )}
    </section>
  );
}

function EarningsLedgerRow({ row }) {
  const isPenalty = row.kind === 'penalty';
  const isCancellation = row.kind === 'cancellation_share';
  const Icon = isPenalty ? AlertOctagon : isCancellation ? XCircle : Car;
  const tone = isPenalty
    ? 'text-rose-700 bg-rose-100'
    : isCancellation
      ? 'text-amber-600 bg-amber-100'
      : 'text-success bg-success/10';
  const title = isPenalty
    ? 'Cancellation penalty'
    : isCancellation
      ? 'Cancellation share'
      : 'Trip earning';
  const subline = [
    row.bookingNumber ? `#${row.bookingNumber}` : null,
    row.serviceType ? labelForService(row.serviceType) : null,
    formatLedgerDate(row.occurredAt),
  ]
    .filter(Boolean)
    .join(' \u00B7 ');

  const sign = row.direction === 'debit' ? '\u2212' : '+';
  const amountTone =
    row.direction === 'debit' ? 'text-rose-700' : 'text-success';

  return (
    <div className="flex items-center gap-3 px-3 py-3">
      <div
        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${tone}`}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text truncate">{title}</p>
        <p className="text-[11px] text-text-muted truncate">{subline}</p>
      </div>
      <p className={`text-sm font-bold ${amountTone} shrink-0`}>
        {sign}
        {formatCurrency(row.amountRupees)}
      </p>
    </div>
  );
}

function labelForService(serviceType) {
  switch (serviceType) {
    case 'hourly':
      return 'Hourly';
    case 'outstation':
      return 'Outstation';
    case 'oneway':
      return 'One-way';
    case 'round_trip':
      return 'Round trip';
    default:
      return serviceType;
  }
}

function formatLedgerDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

/* ------------------------------------------------------------------ */
/* Bar chart                                                           */
/* ------------------------------------------------------------------ */

function EarningsBarChart({ buckets, peak }) {
  const safePeak = peak > 0 ? peak : 1;
  return (
    <div className="flex items-end justify-between gap-2 h-32 mb-2">
      {buckets.map((bucket) => {
        const heightPct = Math.max(4, Math.round((bucket.earnings / safePeak) * 100));
        const isPeak = bucket.earnings > 0 && bucket.earnings === peak;
        return (
          <div
            key={bucket.date}
            className="flex-1 flex flex-col items-center gap-1 min-w-0"
          >
            <span className="text-[10px] font-semibold text-text-muted h-3 leading-3">
              {bucket.earnings > 0 ? `₹${Math.round(bucket.earnings)}` : ''}
            </span>
            <div
              className={`w-full rounded-t-md transition-all ${
                isPeak ? 'bg-primary' : 'bg-primary/30'
              }`}
              style={{ height: `${heightPct}%` }}
            />
            <span className="text-[10px] text-text-muted">{bucket.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export default EarningsPage;
