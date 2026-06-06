import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  LifeBuoy,
  MapPin,
  Clock,
  Phone,
  User as UserIcon,
  CalendarClock,
  Search,
  RefreshCw,
  ShieldCheck,
  Star,
  X,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import Card from '../../../components/Card';
import Button from '../../../components/Button';
import Input from '../../../components/Input';
import Badge from '../../../components/Badge';
import ServerPaginatedTable from '../components/ServerPaginatedTable';
import BookingDetailsModal from '../components/ManageBookings/BookingDetailsModal';
import api from '../../../utils/api';
import useAdminAuthStore from '../../../store/useAdminAuthStore';
import { useSocketEvent } from '../../../hooks/useSocket';
import { S2C_EVENTS } from '../../../constants/socketEvents';
import { STAFF_ROLE_LABELS } from '../../../constants/staffRoles';
import { formatPickupDateTime } from '../../../utils/datetime';

const OPERATIONS_ROLES = new Set(['admin', 'sub_admin']);

/**
 * Admin "Emergency Pool" dashboard.
 *
 *   - Every staff role can view this page.
 *   - admin / sub_admin see every booking in the pool (server scopes).
 *   - team_member sees only entries whose pickup falls in a zone they
 *     are assigned to (also server-scoped via `assignedZones`).
 *   - Only OPERATIONS roles get the "Assign driver" CTA; team_members
 *     see a read-only "view-only — escalate to admin" pill.
 *
 * The page subscribes to `BOOKING_UPDATED` so the queue re-loads
 * whenever the worker flips a new entry into `IN_EMERGENCY_POOL` or
 * an admin assigns one out of it.
 */
const ManageEmergencyPool = () => {
  const admin = useAdminAuthStore((s) => s.admin);
  const canAssign = OPERATIONS_ROLES.has(admin?.role);

  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  // Row-click opens the read-only details panel. We keep it separate
  // from `selectedBooking` (which drives the Assign drawer) so the
  // operator can inspect a booking without committing to assignment.
  const [detailBooking, setDetailBooking] = useState(null);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  const fetchPool = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit });
      if (debounced) params.append('search', debounced);
      const res = await api.get(`/admin/emergency-pool?${params.toString()}`);
      const data = res?.data?.data || {};
      setRows(data.bookings || []);
      setPagination({
        total: data.total || 0,
        pages: data.pages || 1,
      });
      setError(null);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load the emergency pool');
    } finally {
      setLoading(false);
    }
  }, [page, limit, debounced]);

  useEffect(() => {
    fetchPool();
  }, [fetchPool]);

  // Live refresh: any booking transition could either add or remove an
  // entry from the pool. A blanket refetch on BOOKING_UPDATED is cheap
  // and avoids the per-booking merge logic the other admin pages have.
  useSocketEvent(S2C_EVENTS.BOOKING_UPDATED, () => {
    fetchPool();
  });
  useSocketEvent(S2C_EVENTS.ADMIN_ALERT, (payload) => {
    if (payload?.kind === 'emergency_pool_entered') fetchPool();
  });

  const columns = useMemo(
    () => [
      {
        key: 'bookingNumber',
        label: 'Booking',
        width: '18%',
        render: (_, row) => (
          <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded">
            {row.bookingNumber || row._id?.slice(-6)}
          </span>
        ),
      },
      {
        key: 'customer',
        label: 'Customer',
        width: '20%',
        render: (_, row) => (
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">
              {row.userId?.name || 'Unknown'}
            </p>
            <p className="text-[11px] text-slate-500 truncate">
              {row.userId?.phone_no || '—'}
            </p>
          </div>
        ),
      },
      {
        key: 'pickup',
        label: 'Pickup',
        width: '24%',
        render: (_, row) => (
          <div className="min-w-0">
            <p className="text-xs text-slate-700 truncate" title={row.pickup?.address}>
              {row.pickup?.address || '—'}
            </p>
            {(row.zoneIds || []).length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {row.zoneIds.slice(0, 2).map((z) => (
                  <span
                    key={z._id || z}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-semibold"
                  >
                    <MapPin className="w-2.5 h-2.5" />
                    {z?.name || 'Zone'}
                  </span>
                ))}
                {row.zoneIds.length > 2 && (
                  <span className="text-[10px] text-slate-500">
                    +{row.zoneIds.length - 2} more
                  </span>
                )}
              </div>
            )}
          </div>
        ),
      },
      {
        key: 'scheduledStartAt',
        label: 'Pickup time',
        width: '18%',
        render: (_, row) => {
          const at = row.hourly?.scheduledStartAt
            ? new Date(row.hourly.scheduledStartAt)
            : null;
          return (
            <div>
              <p className="text-xs font-medium text-slate-800">
                {formatPickupDateTime(at)}
              </p>
              <p className="text-[10px] text-slate-500">
                <Countdown to={at} />
              </p>
            </div>
          );
        },
      },
      {
        key: 'fare',
        label: 'Fare',
        width: '10%',
        render: (_, row) => (
          <span className="text-sm font-semibold text-emerald-600">
            ₹{row.fareSnapshot?.total || 0}
          </span>
        ),
      },
      {
        key: 'actions',
        label: 'Action',
        sortable: false,
        unclamp: true,
        width: '10%',
        render: (_, row) =>
          canAssign ? (
            <Button
              size="sm"
              onClick={(e) => {
                // Don't bubble to the row-click handler — clicking the
                // Assign CTA should jump straight to the driver-picker
                // drawer, not also open the read-only details panel.
                e.stopPropagation();
                setSelectedBooking(row);
              }}
              icon={UserIcon}
            >
              Assign
            </Button>
          ) : (
            <Badge variant="info" text="View only" />
          ),
      },
    ],
    [canAssign],
  );

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-6 space-y-5 animate-fade-in-up pb-10">
      <div className="bg-gradient-to-br from-amber-500 to-orange-500 text-white rounded-3xl p-5 shadow-sm flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
            <LifeBuoy className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold">Emergency Pool</h1>
            <p className="text-[12px] text-white/80 mt-0.5 leading-snug">
              Scheduled rides we couldn&apos;t auto-assign{' '}
              {admin?.role === 'team_member' ? (
                <>in your zones</>
              ) : (
                <>across the platform</>
              )}{' '}
              within the safety window. {canAssign ? 'Pick a driver to take them off the queue.' : 'Admins will assign drivers manually.'}
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[11px] uppercase tracking-wide text-white/70">In pool</p>
          <p className="text-3xl font-bold leading-tight">{pagination.total}</p>
        </div>
      </div>

      {!canAssign && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-amber-900">
              {STAFF_ROLE_LABELS[admin?.role] || 'Team member'} access
            </p>
            <p className="text-[12px] text-amber-800 leading-snug mt-0.5">
              You can monitor bookings in your assigned zones. Only admins
              and sub-admins can assign a driver.
            </p>
          </div>
        </div>
      )}

      <Card>
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex-1">
            <Input
              icon={Search}
              placeholder="Search booking number or ID"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Button variant="outline" icon={RefreshCw} onClick={fetchPool}>
            Refresh
          </Button>
        </div>
      </Card>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-sm">
          {error}
        </div>
      )}

      <ServerPaginatedTable
        columns={columns}
        data={rows}
        loading={loading}
        page={page}
        limit={limit}
        pagination={pagination}
        onPageChange={setPage}
        onRowClick={(row) => setDetailBooking(row)}
        entityLabel="bookings"
        emptyMessage="No bookings need manual assignment right now."
      />

      {selectedBooking && (
        <AssignDriverDrawer
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onAssigned={() => {
            setSelectedBooking(null);
            fetchPool();
          }}
        />
      )}

      <BookingDetailsModal
        isOpen={!!detailBooking}
        onClose={() => setDetailBooking(null)}
        booking={detailBooking}
      />
    </div>
  );
};

/* ------------------------------------------------------------------ */

function Countdown({ to }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!to) return null;
  const diffMs = to.getTime() - now;
  const past = diffMs < 0;
  const sec = Math.max(0, Math.floor(Math.abs(diffMs) / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const stamp = h > 0 ? `${h}h ${m}m` : `${m}m`;
  return (
    <span
      className={`inline-flex items-center gap-1 ${past ? 'text-rose-600 font-semibold' : 'text-slate-500'}`}
    >
      <Clock className="w-3 h-3" />
      {past ? `${stamp} overdue` : `in ${stamp}`}
    </span>
  );
}

function AssignDriverDrawer({ booking, onClose, onAssigned }) {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState(null);
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get(`/admin/emergency-pool/${booking._id}/available-drivers`)
      .then((res) => {
        if (cancelled) return;
        const data = res?.data?.data || {};
        setDrivers(data.drivers || []);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.response?.data?.message || 'Failed to load drivers');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [booking._id]);

  const filtered = useMemo(() => {
    if (!search.trim()) return drivers;
    const q = search.trim().toLowerCase();
    return drivers.filter(
      (d) =>
        d.name?.toLowerCase().includes(q) ||
        String(d.phone_no || '').includes(q),
    );
  }, [drivers, search]);

  const handleAssign = async () => {
    if (!selectedDriverId) {
      toast.error('Pick a driver first');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/admin/emergency-pool/${booking._id}/assign-driver`, {
        driverId: selectedDriverId,
        notes: notes || '',
      });
      toast.success('Driver assigned');
      onAssigned();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not assign driver');
    } finally {
      setSubmitting(false);
    }
  };

  const pickupAt = booking.hourly?.scheduledStartAt
    ? new Date(booking.hourly.scheduledStartAt)
    : null;

  return (
    <div className="fixed inset-0 z-[9999] flex">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <aside className="ml-auto relative w-full max-w-xl h-full bg-white shadow-2xl overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">
              Assign driver
            </p>
            <h2 className="text-base font-bold text-slate-900 truncate">
              Booking {booking.bookingNumber || booking._id?.slice(-6)}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <Card>
            <div className="space-y-3 text-sm">
              <SummaryRow
                icon={UserIcon}
                label="Customer"
                value={booking.userId?.name || 'Unknown'}
                hint={booking.userId?.phone_no}
              />
              <SummaryRow
                icon={CalendarClock}
                label="Pickup time"
                value={formatPickupDateTime(pickupAt)}
                hint={
                  pickupAt ? (
                    <Countdown to={pickupAt} />
                  ) : null
                }
              />
              <SummaryRow
                icon={MapPin}
                label="Pickup"
                value={booking.pickup?.address || '—'}
                multiline
              />
              <SummaryRow
                icon={Clock}
                label="Duration"
                value={`${booking.hourly?.durationHours || 0} h`}
              />
            </div>
          </Card>

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Choose driver
            </p>
            <Input
              icon={Search}
              placeholder="Search by name or phone"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="mt-3 space-y-2 max-h-80 overflow-y-auto pr-1">
              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                </div>
              ) : error ? (
                <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-sm">
                  {error}
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-6 rounded-xl bg-slate-50 text-slate-500 text-sm text-center">
                  <AlertTriangle className="w-5 h-5 mx-auto mb-2 text-amber-500" />
                  No approved, idle drivers available right now.
                </div>
              ) : (
                filtered.map((d) => {
                  const active = String(selectedDriverId) === String(d._id);
                  return (
                    <button
                      key={d._id}
                      type="button"
                      onClick={() => setSelectedDriverId(d._id)}
                      className={`w-full text-left flex items-center gap-3 p-3 rounded-2xl border transition ${
                        active
                          ? 'border-primary bg-primary/5'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center font-bold uppercase shrink-0">
                        {d.name?.charAt(0) || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {d.name}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
                          <span className="inline-flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {d.phone_no || '—'}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Star className="w-3 h-3 text-amber-500" />
                            {Number(d.rating || 0).toFixed(1)}
                          </span>
                          <span>{d.experienceYears || 0}y exp.</span>
                          {d.isOnline && (
                            <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Online
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Notes (optional)
            </p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Anything to keep on the audit trail?"
              className="w-full text-sm rounded-2xl border border-slate-200 px-3 py-2 focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-5 py-3 flex gap-3">
          <Button variant="outline" fullWidth onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            fullWidth
            loading={submitting}
            disabled={!selectedDriverId}
            onClick={handleAssign}
          >
            Assign driver
          </Button>
        </div>
      </aside>
    </div>
  );
}

function SummaryRow({ icon: Icon, label, value, hint, multiline = false }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-slate-500 uppercase tracking-wide">{label}</p>
        <p
          className={`text-sm font-semibold text-slate-900 ${
            multiline ? 'break-words' : 'truncate'
          }`}
        >
          {value}
        </p>
        {hint && <div className="text-[11px] text-slate-500 mt-0.5">{hint}</div>}
      </div>
    </div>
  );
}

export default ManageEmergencyPool;
