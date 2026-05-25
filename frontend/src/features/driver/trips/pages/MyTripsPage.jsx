import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, Inbox } from 'lucide-react';
import Card from '../../../../components/Card';
import Button from '../../../../components/Button';
import { useCachedQuery } from '../../../../hooks/useCachedQuery';
import { buildCacheKey } from '../../../../store/lib/buildCacheKey';
import { useDriverTripsListStore } from '../../../../store/driver/useDriverTripsStore';
import { ACTIVE_BOOKING_STATUSES } from '../../../../constants/bookingStatus';
import DriverScreenShell from '../../components/DriverScreenShell';
import DriverTripCard from '../components/DriverTripCard';

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'ongoing', label: 'Ongoing' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
];

const PAGE_LIMIT = 15;

/**
 * Driver trip history.
 *
 * Sticky dark header (title + tab bar) + scrollable list body.
 * Reuses `DriverTripCard` (shared with the earnings page's "recent
 * payouts" feed) so any future fields added there land here for free.
 */
const MyTripsPage = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState('all');
  const [page, setPage] = useState(1);

  const params = useMemo(
    () => ({ tab, page, limit: PAGE_LIMIT }),
    [tab, page],
  );
  const cacheKey = buildCacheKey('driver-trips-list', params);

  const { data, loading, error, refetch } = useCachedQuery(
    useDriverTripsListStore,
    cacheKey,
    params,
  );

  const trips = data?.data || [];
  const pagination = data?.pagination || { total: 0, page: 1, pages: 1 };

  const handleSelect = (trip) => {
    if (!trip) return;
    if (ACTIVE_BOOKING_STATUSES.includes(trip.status)) {
      navigate(`/driver/trip/${trip._id}`);
    }
    // Completed/cancelled trips don't have a dedicated details page yet —
    // wire one up by routing to `/driver/trip/:id` once it learns to render
    // archived bookings, then this branch will resolve naturally.
  };

  const totalTrips = pagination.total || 0;

  return (
    <DriverScreenShell
      header={
        <header className="bg-dark px-4 pt-4 pb-4 rounded-b-3xl">
          <div className="flex items-baseline justify-between mb-3">
            <h1 className="text-lg font-bold text-white">My Trips</h1>
            {totalTrips > 0 && (
              <span className="text-[11px] text-white/60">
                {totalTrips} trip{totalTrips === 1 ? '' : 's'}
              </span>
            )}
          </div>
          <TabBar
            tabs={TABS}
            active={tab}
            onChange={(t) => {
              setTab(t);
              setPage(1);
            }}
          />
        </header>
      }
      bodyClassName="p-4 -mt-2 pb-8 space-y-3"
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
              <p className="text-sm font-medium text-text">Couldn't load trips</p>
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

      {!loading && !error && trips.length === 0 && (
        <Card className="flex flex-col items-center justify-center py-14 text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
            <Inbox className="w-6 h-6 text-primary" />
          </div>
          <p className="text-sm font-semibold text-text">No trips here yet</p>
          <p className="text-xs text-text-muted mt-1 max-w-[240px]">
            Once you accept a booking, it'll show up in this list with its full history.
          </p>
        </Card>
      )}

      {trips.map((trip, idx) => (
        <DriverTripCard
          key={trip._id}
          trip={trip}
          onClick={
            ACTIVE_BOOKING_STATUSES.includes(trip.status)
              ? () => handleSelect(trip)
              : undefined
          }
          className="animate-fade-in-up"
          style={{ animationDelay: `${idx * 0.04}s` }}
        />
      ))}

      {pagination.pages > 1 && (
        <Pagination
          page={pagination.page}
          pages={pagination.pages}
          total={pagination.total}
          onChange={setPage}
          disabled={loading}
        />
      )}
    </DriverScreenShell>
  );
};

/* ------------------------------------------------------------------ */
/* Tab bar + Pagination                                                */
/* ------------------------------------------------------------------ */

function TabBar({ tabs, active, onChange }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
      {tabs.map((t) => {
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
              isActive
                ? 'bg-white text-text shadow-card'
                : 'bg-white/10 text-white/80 hover:bg-white/15'
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function Pagination({ page, pages, total, onChange, disabled }) {
  return (
    <div className="flex items-center justify-between pt-1 pb-2 text-xs text-text-muted">
      <span>
        Page {page} of {pages} · {total} trip{total === 1 ? '' : 's'}
      </span>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="ghost"
          disabled={disabled || page <= 1}
          onClick={() => onChange(page - 1)}
        >
          Prev
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={disabled || page >= pages}
          onClick={() => onChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

export default MyTripsPage;
