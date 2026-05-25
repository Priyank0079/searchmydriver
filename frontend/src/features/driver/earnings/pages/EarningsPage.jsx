import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../../../components/Card';
import Button from '../../../../components/Button';
import {
  Loader2,
  AlertCircle,
  TrendingUp,
  Wallet,
  Inbox,
} from 'lucide-react';
import { useCachedQuery } from '../../../../hooks/useCachedQuery';
import { buildCacheKey } from '../../../../store/lib/buildCacheKey';
import { useDriverEarningsStore } from '../../../../store/driver/useDriverTripsStore';
import { formatCurrency } from '../../../../utils/formatters';
import DriverScreenShell from '../../components/DriverScreenShell';
import DriverTripCard from '../../trips/components/DriverTripCard';

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

  const summary = data?.summary || {};
  const today = summary.today || EMPTY;
  const week = summary.week || EMPTY;
  const month = summary.month || EMPTY;
  const buckets = data?.daily?.buckets || [];
  const peak = data?.daily?.peak || 0;
  const recent = data?.recent || [];

  const stats = useMemo(
    () => [
      { label: 'Today', amount: formatCurrency(today.earnings), trips: today.trips },
      { label: 'This Week', amount: formatCurrency(week.earnings), trips: week.trips },
      { label: 'This Month', amount: formatCurrency(month.earnings), trips: month.trips },
    ],
    [today, week, month],
  );

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

          <Button
            fullWidth
            variant="driver"
            icon={Wallet}
            onClick={() => navigate('/driver/payments')}
          >
            View payout history
          </Button>

          <RecentPayouts
            recent={recent}
            onSeeAll={() => navigate('/driver/trips')}
          />
        </>
      )}
    </DriverScreenShell>
  );
};

/* ------------------------------------------------------------------ */
/* Recent payouts                                                      */
/* ------------------------------------------------------------------ */

/**
 * Last 10 completed trips. Reused from the trips page so card chrome
 * stays consistent. Scrolls inline with the page — the parent shell owns
 * the scroll behaviour so we don't fight it with a second scroller.
 */
function RecentPayouts({ recent, onSeeAll }) {
  return (
    <section>
      <div className="flex items-center justify-between mb-2 px-1">
        <p className="text-xs uppercase tracking-wide font-semibold text-text-muted">
          Recent payouts
        </p>
        {recent.length > 0 && (
          <button
            type="button"
            onClick={onSeeAll}
            className="text-[11px] font-semibold text-primary"
          >
            See all
          </button>
        )}
      </div>
      {recent.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-10 text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
            <Inbox className="w-6 h-6 text-primary" />
          </div>
          <p className="text-sm font-semibold text-text">No completed trips yet</p>
          <p className="text-xs text-text-muted mt-1 max-w-[240px]">
            Once you finish a trip, it shows up here with the payout.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {recent.map((trip, idx) => (
            <DriverTripCard
              key={trip._id}
              trip={trip}
              className="animate-fade-in-up"
              style={{ animationDelay: `${idx * 0.04}s` }}
            />
          ))}
        </div>
      )}
    </section>
  );
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
