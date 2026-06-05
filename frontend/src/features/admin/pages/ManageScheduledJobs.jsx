import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshCw,
  Timer,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  PlayCircle,
  CalendarClock,
  Hourglass,
} from 'lucide-react';
import api from '../../../utils/api';
import Card from '../../../components/Card';
import Button from '../../../components/Button';
import Badge from '../../../components/Badge';
import Select from '../../../components/Select';
import ServerPaginatedTable from '../components/ServerPaginatedTable';
import BookingDetailsModal from '../components/ManageBookings/BookingDetailsModal';
import { useSocketEvent } from '../../../hooks/useSocket';
import { S2C_EVENTS } from '../../../constants/socketEvents';
import { formatPickupDateTime } from '../../../utils/datetime';

/**
 * Admin "Scheduled Jobs" dashboard.
 *
 * Reads the BullMQ scheduled-booking queue directly so ops can see:
 *   - which assignments are queued and when they fire (delayed)
 *   - which jobs are mid-run (active) or recently failed
 *   - which reminders / escalations have already completed
 *
 * Refreshes on `BOOKING_UPDATED` socket events so cancellations and
 * assignments fall off the list without a manual refresh.
 */

const STATE_VARIANTS = {
  delayed: { variant: 'info', label: 'Delayed', icon: Hourglass },
  waiting: { variant: 'warning', label: 'Waiting', icon: Clock },
  active: { variant: 'primary', label: 'Running', icon: PlayCircle },
  failed: { variant: 'danger', label: 'Failed', icon: AlertTriangle },
  completed: { variant: 'success', label: 'Done', icon: CheckCircle2 },
};

const KIND_LABELS = {
  assign: 'Driver assign',
  escalate: 'Emergency escalate',
  reminder: 'Reminder',
};

function StateBadge({ state }) {
  const cfg = STATE_VARIANTS[state] || STATE_VARIANTS.waiting;
  const Icon = cfg.icon;
  return (
    <Badge variant={cfg.variant} className="inline-flex items-center gap-1 capitalize">
      <Icon className="w-3 h-3" />
      {cfg.label}
    </Badge>
  );
}

function CountdownTo({ iso }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!iso) return null;
  const target = new Date(iso).getTime();
  const diff = target - now;
  const past = diff < 0;
  const totalSec = Math.max(0, Math.floor(Math.abs(diff) / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const stamp = h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;
  return (
    <span
      className={`inline-flex items-center gap-1 ${past ? 'text-rose-600 font-semibold' : 'text-slate-500'}`}
    >
      <Clock className="w-3 h-3" />
      {past ? `${stamp} overdue` : `in ${stamp}`}
    </span>
  );
}

const ManageScheduledJobs = () => {
  const [snapshot, setSnapshot] = useState({
    enabled: true,
    counts: {},
    jobs: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [stateFilter, setStateFilter] = useState('');
  const [kindFilter, setKindFilter] = useState('');
  const [selectedBooking, setSelectedBooking] = useState(null);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/bookings/scheduled-jobs');
      setSnapshot(res?.data?.data || { enabled: false, counts: {}, jobs: [] });
      setError(null);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load scheduled jobs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // A booking transition can either consume or create a scheduled job
  // (cancel → remove, schedule → enqueue). A blanket refetch is cheap.
  useSocketEvent(S2C_EVENTS.BOOKING_UPDATED, () => fetchJobs());

  const filteredJobs = useMemo(() => {
    return snapshot.jobs.filter((job) => {
      if (stateFilter && job.state !== stateFilter) return false;
      if (kindFilter && job.name !== kindFilter) return false;
      return true;
    });
  }, [snapshot.jobs, stateFilter, kindFilter]);

  const pagedJobs = useMemo(
    () => filteredJobs.slice((page - 1) * limit, page * limit),
    [filteredJobs, page, limit],
  );

  const pagination = {
    total: filteredJobs.length,
    pages: Math.max(1, Math.ceil(filteredJobs.length / limit)),
  };

  // Find the very next delayed job so we can headline it.
  const nextScheduled = useMemo(() => {
    return snapshot.jobs
      .filter((j) => j.state === 'delayed' && j.nextRunAt)
      .sort(
        (a, b) => new Date(a.nextRunAt).getTime() - new Date(b.nextRunAt).getTime(),
      )[0];
  }, [snapshot.jobs]);

  const openBooking = async (bookingId) => {
    if (!bookingId) return;
    try {
      const res = await api.get(`/admin/bookings/${bookingId}`);
      setSelectedBooking(res?.data?.data?.booking || null);
    } catch (err) {
      console.warn('[scheduledJobs] failed to load booking', err?.message);
    }
  };

  const counts = snapshot.counts || {};
  const totalQueued =
    (counts.delayed || 0) +
    (counts.waiting || 0) +
    (counts.active || 0);

  const columns = useMemo(
    () => [
      {
        key: 'name',
        label: 'Job',
        width: '18%',
        render: (_, row) => (
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">
              {KIND_LABELS[row.name] || row.name}
              {row.name === 'reminder' && row.minutesAhead != null && (
                <span className="text-xs text-slate-500 ml-1">
                  · -{row.minutesAhead}m
                </span>
              )}
            </p>
            <p className="text-[11px] text-slate-400 font-mono truncate">
              {row.id}
            </p>
          </div>
        ),
      },
      {
        key: 'booking',
        label: 'Booking',
        width: '22%',
        render: (_, row) =>
          row.booking ? (
            <button
              type="button"
              className="text-left"
              onClick={(e) => {
                e.stopPropagation();
                openBooking(row.bookingId);
              }}
            >
              <p className="text-sm font-semibold text-primary hover:underline">
                {row.booking.bookingNumber || row.bookingId?.slice(-6)}
              </p>
              <p className="text-[11px] text-slate-500 truncate">
                {row.booking.customerName || 'Customer'}
                {row.booking.bookingType && (
                  <span className="ml-1 uppercase text-[10px] text-slate-400">
                    · {row.booking.bookingType}
                  </span>
                )}
              </p>
            </button>
          ) : (
            <span className="text-xs text-slate-400 font-mono">
              {row.bookingId?.slice(-8) || '—'}
            </span>
          ),
      },
      {
        key: 'scheduledStartAt',
        label: 'Pickup',
        width: '18%',
        render: (_, row) => {
          const at = row.booking?.scheduledStartAt || row.scheduledStartAt;
          return (
            <div>
              <p className="text-xs font-medium text-slate-800">
                {formatPickupDateTime(at ? new Date(at) : null)}
              </p>
            </div>
          );
        },
      },
      {
        key: 'nextRunAt',
        label: 'Next run',
        width: '20%',
        render: (_, row) => {
          if (row.state === 'completed' && row.finishedOn) {
            return (
              <div>
                <p className="text-xs text-slate-700">
                  {new Date(row.finishedOn).toLocaleString()}
                </p>
                <p className="text-[11px] text-slate-400">finished</p>
              </div>
            );
          }
          if (row.state === 'failed' && row.failedReason) {
            return (
              <div className="min-w-0">
                <p
                  className="text-xs text-rose-600 truncate"
                  title={row.failedReason}
                >
                  {row.failedReason}
                </p>
                <p className="text-[11px] text-slate-400">
                  attempts {row.attemptsMade}
                </p>
              </div>
            );
          }
          if (row.nextRunAt) {
            return (
              <div>
                <p className="text-xs text-slate-700">
                  {new Date(row.nextRunAt).toLocaleString()}
                </p>
                <p className="text-[11px] text-slate-500">
                  <CountdownTo iso={row.nextRunAt} />
                </p>
              </div>
            );
          }
          return <span className="text-xs text-slate-400">—</span>;
        },
      },
      {
        key: 'state',
        label: 'Status',
        width: '12%',
        render: (_, row) => <StateBadge state={row.state} />,
      },
      {
        key: 'createdAt',
        label: 'Queued',
        width: '10%',
        render: (_, row) =>
          row.createdAt ? (
            <span className="text-xs text-slate-500">
              {new Date(row.createdAt).toLocaleString()}
            </span>
          ) : (
            <span className="text-xs text-slate-400">—</span>
          ),
      },
    ],
    [],
  );

  return (
    <div className="min-h-screen bg-slate-50 space-y-6 animate-fade-in-up p-4 lg:p-6">
      <div className="bg-gradient-to-br from-indigo-500 to-blue-600 text-white rounded-3xl p-5 shadow-sm flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
            <Timer className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold">Scheduled Jobs</h1>
            <p className="text-[12px] text-white/80 mt-0.5 leading-snug">
              Live snapshot of every dispatch, reminder and escalation
              queued for future-scheduled rides.
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[11px] uppercase tracking-wide text-white/70">
            Queued
          </p>
          <p className="text-3xl font-bold leading-tight">{totalQueued}</p>
        </div>
      </div>

      {!snapshot.enabled && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-amber-900">
              Job queue not connected
            </p>
            <p className="text-[12px] text-amber-800 leading-snug mt-0.5">
              REDIS_URL is not configured. Scheduled-ride jobs are not
              firing — set REDIS_URL in the backend env and restart to
              activate the worker.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {[
          { label: 'Delayed', value: counts.delayed || 0, icon: Hourglass, color: 'bg-indigo-100', iconColor: 'text-indigo-600' },
          { label: 'Waiting', value: counts.waiting || 0, icon: Clock, color: 'bg-amber-100', iconColor: 'text-amber-600' },
          { label: 'Running', value: counts.active || 0, icon: PlayCircle, color: 'bg-sky-100', iconColor: 'text-sky-600' },
          { label: 'Failed', value: counts.failed || 0, icon: AlertTriangle, color: 'bg-rose-100', iconColor: 'text-rose-600' },
          { label: 'Completed', value: counts.completed || 0, icon: CheckCircle2, color: 'bg-emerald-100', iconColor: 'text-emerald-600' },
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
                  {stat.label}
                </p>
                <h2 className={`text-3xl font-bold mt-2 ${stat.iconColor}`}>
                  {stat.value}
                </h2>
              </div>
              <div className={`w-12 h-12 rounded-2xl ${stat.color} flex items-center justify-center`}>
                <stat.icon className={`w-6 h-6 ${stat.iconColor}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {nextScheduled && (
        <Card>
          <div className="flex items-start gap-3 p-1">
            <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
              <CalendarClock className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-slate-500 uppercase tracking-wide">
                Next scheduled job
              </p>
              <p className="text-sm font-bold text-slate-900 mt-0.5">
                {KIND_LABELS[nextScheduled.name] || nextScheduled.name}
                {nextScheduled.booking
                  ? ` · #${nextScheduled.booking.bookingNumber}`
                  : ''}
              </p>
              <p className="text-[12px] text-slate-500 mt-0.5">
                Fires at {new Date(nextScheduled.nextRunAt).toLocaleString()}{' '}
                · <CountdownTo iso={nextScheduled.nextRunAt} />
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="md:w-52">
            <Select
              value={stateFilter}
              onChange={(val) => {
                setStateFilter(val);
                setPage(1);
              }}
              placeholder="All states"
              options={[
                { value: '', label: 'All states' },
                { value: 'delayed', label: 'Delayed' },
                { value: 'waiting', label: 'Waiting' },
                { value: 'active', label: 'Running' },
                { value: 'failed', label: 'Failed' },
                { value: 'completed', label: 'Completed' },
              ]}
            />
          </div>
          <div className="md:w-52">
            <Select
              value={kindFilter}
              onChange={(val) => {
                setKindFilter(val);
                setPage(1);
              }}
              placeholder="All job kinds"
              options={[
                { value: '', label: 'All job kinds' },
                { value: 'assign', label: 'Driver assign' },
                { value: 'reminder', label: 'Reminder' },
                { value: 'escalate', label: 'Emergency escalate' },
              ]}
            />
          </div>
          <div className="md:ml-auto">
            <Button variant="outline" icon={RefreshCw} onClick={fetchJobs}>
              Refresh
            </Button>
          </div>
        </div>
      </Card>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {loading && !snapshot.jobs.length ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : (
        <ServerPaginatedTable
          columns={columns}
          data={pagedJobs}
          loading={loading}
          page={page}
          limit={limit}
          pagination={pagination}
          onPageChange={setPage}
          entityLabel="jobs"
          emptyMessage="No scheduled jobs match your filters."
          onRowClick={(row) => openBooking(row.bookingId)}
        />
      )}

      <BookingDetailsModal
        isOpen={!!selectedBooking}
        onClose={() => setSelectedBooking(null)}
        booking={selectedBooking}
      />
    </div>
  );
};

export default ManageScheduledJobs;
