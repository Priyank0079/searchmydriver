import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Compass,
  MapPin,
  Clock,
  Phone,
  User as UserIcon,
  Search,
  RefreshCw,
  ShieldCheck,
  Star,
  X,
  AlertTriangle,
  Loader2,
  CalendarRange,
  Car as CarIcon,
  Route as RouteIcon,
  Filter,
} from 'lucide-react';
import Card from '../../../components/Card';
import Button from '../../../components/Button';
import Input from '../../../components/Input';
import Badge from '../../../components/Badge';
import ServerPaginatedTable from '../components/ServerPaginatedTable';
import BookingDetailsModal from '../components/ManageBookings/BookingDetailsModal';
import api from '../../../utils/api';
import useAdminAuthStore from '../../../store/useAdminAuthStore';
import { useAdminZonesStore } from '../../../store/admin/useAdminZonesStore';
import { useSocketEvent } from '../../../hooks/useSocket';
import { S2C_EVENTS } from '../../../constants/socketEvents';
import { STAFF_ROLE_LABELS } from '../../../constants/staffRoles';
import {
  formatPickupDateTime,
  formatDateTime12,
} from '../../../utils/datetime';

const OPERATIONS_ROLES = new Set(['admin', 'sub_admin']);

/**
 * Admin "Outstation Assignments" queue.
 *
 *   Outstation bookings never auto-dispatch — they sit in
 *   PENDING_ASSIGNMENT until staff manually picks a driver here.
 *
 *   - admin / sub_admin → every zone, can assign.
 *   - team_member       → only their assigned zones, view-only.
 *
 *   Filters: search, zone, pickup city, booking type, date range.
 *   The page subscribes to BOOKING_UPDATED so the list re-loads any
 *   time a booking is assigned/cancelled elsewhere.
 */
const ManageOutstationAssignments = () => {
  const admin = useAdminAuthStore((s) => s.admin);
  const canAssign = OPERATIONS_ROLES.has(admin?.role);

  const fetchZones = useAdminZonesStore((s) => s.fetch);
  const zonesEntry = useAdminZonesStore((s) => s.getEntry('admin-zones'));
  const zones = useMemo(
    () => (Array.isArray(zonesEntry?.data) ? zonesEntry.data : []),
    [zonesEntry],
  );

  useEffect(() => {
    if (canAssign) {
      fetchZones?.('admin-zones', {}).catch(() => {});
    }
  }, [fetchZones, canAssign]);

  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [filters, setFilters] = useState({
    search: '',
    zoneId: '',
    city: '',
    bookingType: '',
    dateFrom: '',
    dateTo: '',
  });
  const [debouncedFilters, setDebouncedFilters] = useState(filters);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [assignBooking, setAssignBooking] = useState(null);
  const [detailBooking, setDetailBooking] = useState(null);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedFilters(filters), 300);
    return () => clearTimeout(id);
  }, [filters]);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit });
      Object.entries(debouncedFilters).forEach(([k, v]) => {
        if (v) params.append(k, v);
      });
      const res = await api.get(`/admin/outstation-assignments?${params.toString()}`);
      const data = res?.data?.data || {};
      setRows(data.bookings || []);
      setPagination({
        total: data.total || 0,
        pages: data.pages || 1,
      });
      setError(null);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load outstation queue');
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedFilters]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  useSocketEvent(S2C_EVENTS.BOOKING_UPDATED, () => fetchQueue());

  const hasActiveFilters = useMemo(
    () =>
      Boolean(
        debouncedFilters.zoneId ||
          debouncedFilters.city ||
          debouncedFilters.bookingType ||
          debouncedFilters.dateFrom ||
          debouncedFilters.dateTo,
      ),
    [debouncedFilters],
  );

  const columns = useMemo(
    () => [
      {
        key: 'bookingNumber',
        label: 'Booking',
        width: '16%',
        render: (_, row) => (
          <div>
            <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded">
              {row.bookingNumber || row._id?.slice(-6)}
            </span>
            <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wide">
              {row.bookingType || 'instant'}
            </p>
          </div>
        ),
      },
      {
        key: 'customer',
        label: 'Customer',
        width: '17%',
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
        label: 'Pickup → Destination',
        width: '26%',
        render: (_, row) => (
          <div className="min-w-0 space-y-1">
            <p
              className="text-xs text-slate-700 truncate"
              title={row.pickup?.address}
            >
              <MapPin className="w-3 h-3 inline -mt-0.5 mr-1 text-emerald-600" />
              {row.pickup?.address || '—'}
            </p>
            <p
              className="text-xs text-slate-700 truncate"
              title={row.outstation?.destinationAddress}
            >
              <RouteIcon className="w-3 h-3 inline -mt-0.5 mr-1 text-rose-600" />
              {row.outstation?.destinationAddress || '—'}
            </p>
            {(row.zoneIds || []).length > 0 && (
              <div className="flex flex-wrap gap-1">
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
        key: 'schedule',
        label: 'Trip schedule',
        width: '22%',
        render: (_, row) => {
          // Prefer pickupAt / expectedReturnAt — they're the exact
          // datetimes the customer chose. Fall back to startDate /
          // endDate for legacy rows that pre-date the datetime fields.
          const startSrc =
            row.outstation?.pickupAt || row.outstation?.startDate;
          const endSrc =
            row.outstation?.expectedReturnAt || row.outstation?.endDate;
          const start = startSrc ? new Date(startSrc) : null;
          const end = endSrc ? new Date(endSrc) : null;
          const days = row.outstation?.days || 0;
          const nights = row.outstation?.nights || 0;
          return (
            <div className="text-xs text-slate-700">
              <div className="flex items-center gap-1.5">
                <CalendarRange className="w-3.5 h-3.5 text-slate-500" />
                <span className="font-medium">
                  {start ? formatDateTime12(start) : '\u2014'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Return: {end ? formatDateTime12(end) : '\u2014'}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {days} day{days === 1 ? '' : 's'} \u00b7 {nights} night
                {nights === 1 ? '' : 's'}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                <Countdown to={start} />
              </p>
            </div>
          );
        },
      },
      {
        key: 'fare',
        label: 'Fare',
        width: '11%',
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
        width: '11%',
        render: (_, row) =>
          canAssign ? (
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setAssignBooking(row);
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
      {/* Hero */}
      <div className="bg-gradient-to-br from-sky-600 to-indigo-600 text-white rounded-3xl p-5 shadow-sm flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
            <Compass className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold">Outstation Assignments</h1>
            <p className="text-[12px] text-white/85 mt-0.5 leading-snug">
              Multi-day trips waiting for a driver{' '}
              {admin?.role === 'team_member' ? (
                <>in your zones</>
              ) : (
                <>across the platform</>
              )}
              . {canAssign ? 'Pick a driver — conflicts are validated automatically.' : 'Admins will assign drivers manually.'}
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[11px] uppercase tracking-wide text-white/70">In queue</p>
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
              You can monitor outstation requests in your assigned zones.
              Only admins and sub-admins can assign a driver.
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <Card>
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-slate-700">
            <Filter className="w-4 h-4 text-slate-500" />
            <p className="text-xs font-semibold uppercase tracking-wider">
              Filters
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() =>
                  setFilters({
                    search: filters.search,
                    zoneId: '',
                    city: '',
                    bookingType: '',
                    dateFrom: '',
                    dateTo: '',
                  })
                }
                className="ml-auto text-[11px] text-rose-600 font-semibold hover:underline"
              >
                Clear all
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <Input
              icon={Search}
              placeholder="Booking # / id"
              value={filters.search}
              onChange={(e) => {
                setFilters((f) => ({ ...f, search: e.target.value }));
                setPage(1);
              }}
            />
            {canAssign && (
              <select
                value={filters.zoneId}
                onChange={(e) => {
                  setFilters((f) => ({ ...f, zoneId: e.target.value }));
                  setPage(1);
                }}
                className="w-full text-sm rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:border-primary"
              >
                <option value="">All zones</option>
                {zones.map((z) => (
                  <option key={z._id} value={z._id}>
                    {z.name} {z.city ? `· ${z.city}` : ''}
                  </option>
                ))}
              </select>
            )}
            <Input
              placeholder="Pickup city"
              value={filters.city}
              onChange={(e) => {
                setFilters((f) => ({ ...f, city: e.target.value }));
                setPage(1);
              }}
            />
            <select
              value={filters.bookingType}
              onChange={(e) => {
                setFilters((f) => ({ ...f, bookingType: e.target.value }));
                setPage(1);
              }}
              className="w-full text-sm rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:border-primary"
            >
              <option value="">All booking types</option>
              <option value="instant">Instant</option>
              <option value="scheduled">Scheduled</option>
            </select>
            <div>
              <label className="text-[11px] text-slate-500 block mb-1">
                Start date from
              </label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => {
                  setFilters((f) => ({ ...f, dateFrom: e.target.value }));
                  setPage(1);
                }}
                className="w-full text-sm rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-500 block mb-1">
                Start date to
              </label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => {
                  setFilters((f) => ({ ...f, dateTo: e.target.value }));
                  setPage(1);
                }}
                className="w-full text-sm rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:border-primary"
              />
            </div>
            <div className="md:col-span-2 lg:col-span-2 flex md:justify-end">
              <Button variant="outline" icon={RefreshCw} onClick={fetchQueue}>
                Refresh
              </Button>
            </div>
          </div>
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
        emptyMessage="No outstation trips waiting for assignment."
      />

      {assignBooking && (
        <AssignOutstationDrawer
          booking={assignBooking}
          onClose={() => setAssignBooking(null)}
          onAssigned={() => {
            setAssignBooking(null);
            fetchQueue();
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

/* ================================================================== */
/* Helpers                                                             */
/* ================================================================== */

function Countdown({ to }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  if (!to) return null;
  const diffMs = to.getTime() - now;
  const past = diffMs < 0;
  const sec = Math.max(0, Math.floor(Math.abs(diffMs) / 1000));
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const stamp = d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
  return (
    <span
      className={`inline-flex items-center gap-1 ${past ? 'text-rose-600 font-semibold' : 'text-slate-500'}`}
    >
      <Clock className="w-3 h-3" />
      {past ? `${stamp} overdue` : `in ${stamp}`}
    </span>
  );
}

/* ================================================================== */
/* Assign drawer                                                       */
/* ================================================================== */

function AssignOutstationDrawer({ booking, onClose, onAssigned }) {
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [detailError, setDetailError] = useState(null);

  const [drivers, setDrivers] = useState([]);
  const [driversLoading, setDriversLoading] = useState(true);
  const [driversError, setDriversError] = useState(null);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(id);
  }, [search]);

  // Booking detail (with vehicle conflicts).
  useEffect(() => {
    let cancelled = false;
    setDetailLoading(true);
    api
      .get(`/admin/outstation-assignments/${booking._id}`)
      .then((res) => {
        if (cancelled) return;
        setDetail(res?.data?.data || null);
        setDetailError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setDetailError(err?.response?.data?.message || 'Failed to load booking');
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [booking._id]);

  // Driver list with conflict flags.
  useEffect(() => {
    let cancelled = false;
    setDriversLoading(true);
    const params = new URLSearchParams();
    if (debouncedSearch) params.append('search', debouncedSearch);
    api
      .get(
        `/admin/outstation-assignments/${booking._id}/available-drivers?${params.toString()}`,
      )
      .then((res) => {
        if (cancelled) return;
        const data = res?.data?.data || {};
        setDrivers(data.drivers || []);
        setDriversError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setDriversError(err?.response?.data?.message || 'Failed to load drivers');
      })
      .finally(() => {
        if (!cancelled) setDriversLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [booking._id, debouncedSearch]);

  const selectedDriver = useMemo(
    () => drivers.find((d) => String(d._id) === String(selectedDriverId)) || null,
    [drivers, selectedDriverId],
  );

  const vehicleConflicts = detail?.vehicleConflicts || [];
  const hasVehicleConflict = vehicleConflicts.length > 0;

  const handleAssign = async () => {
    if (!selectedDriverId) {
      toast.error('Pick a driver first');
      return;
    }
    if (selectedDriver?.hasConflict) {
      toast.error('This driver has an overlapping booking. Pick another.');
      return;
    }
    if (hasVehicleConflict) {
      toast.error('This vehicle is in an overlapping booking. Resolve first.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(
        `/admin/outstation-assignments/${booking._id}/assign-driver`,
        { driverId: selectedDriverId, notes: notes || '' },
      );
      toast.success('Driver assigned');
      onAssigned();
    } catch (err) {
      const data = err?.response?.data;
      const conflicts = data?.data?.conflicts || data?.conflicts;
      const message = data?.message || 'Could not assign driver';
      if (conflicts?.length) {
        toast.error(
          `${message} (${conflicts.length} overlapping ride${conflicts.length === 1 ? '' : 's'})`,
        );
      } else {
        toast.error(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Prefer pickupAt / expectedReturnAt — the exact datetimes the
  // customer picked. Older bookings fall back to startDate/endDate.
  const startSrc =
    booking.outstation?.pickupAt || booking.outstation?.startDate;
  const endSrc =
    booking.outstation?.expectedReturnAt || booking.outstation?.endDate;
  const start = startSrc ? new Date(startSrc) : null;
  const end = endSrc ? new Date(endSrc) : null;
  const bufferMinutes = detail?.bufferMinutes ?? 30;

  return (
    <div className="fixed inset-0 z-[9999] flex">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <aside className="ml-auto relative w-full max-w-2xl h-full bg-white shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-4 flex items-center justify-between gap-3 z-10">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">
              Outstation assignment
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
          {/* Trip summary */}
          <Card>
            <div className="space-y-3 text-sm">
              <SummaryRow
                icon={UserIcon}
                label="Customer"
                value={booking.userId?.name || 'Unknown'}
                hint={booking.userId?.phone_no}
              />
              <SummaryRow
                icon={MapPin}
                label="Pickup"
                value={booking.pickup?.address || '—'}
                multiline
              />
              <SummaryRow
                icon={RouteIcon}
                label="Destination"
                value={booking.outstation?.destinationAddress || '—'}
                multiline
              />
              <SummaryRow
                icon={CalendarRange}
                label="Window"
                value={
                  start && end
                    ? `${formatDateTime12(start)} → ${formatDateTime12(end)}`
                    : '—'
                }
                hint={`${booking.outstation?.days || 0} days · ${booking.outstation?.nights || 0} nights`}
              />
              <SummaryRow
                icon={CarIcon}
                label="Vehicle"
                value={
                  detail?.car
                    ? `${detail.car.brandId?.name || ''} ${detail.car.modelId?.name || ''} · ${detail.car.vehicleNumber || ''}`
                    : detailLoading
                      ? 'Loading…'
                      : '—'
                }
                hint={detail?.car?.carTypeId?.name || null}
              />
              <SummaryRow
                icon={Clock}
                label="Buffer window"
                value={`±${bufferMinutes} min`}
                hint="Drivers/vehicles inside this padding count as conflicts"
              />
            </div>
          </Card>

          {/* Vehicle conflicts banner */}
          {hasVehicleConflict && (
            <ConflictBanner
              tone="rose"
              title="Vehicle has overlapping bookings"
              subtitle="This car is already booked in the window below. Resolve before assigning."
              conflicts={vehicleConflicts}
            />
          )}
          {detailError && (
            <div className="p-3 rounded-2xl bg-rose-50 text-rose-700 text-sm">
              {detailError}
            </div>
          )}

          {/* Driver picker */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Choose driver
              </p>
              {drivers.length > 0 && (
                <span className="text-[11px] text-slate-500">
                  {drivers.filter((d) => !d.hasConflict).length} available ·{' '}
                  {drivers.filter((d) => d.hasConflict).length} with conflicts
                </span>
              )}
            </div>
            <Input
              icon={Search}
              placeholder="Search by name or phone"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="mt-3 space-y-2 max-h-96 overflow-y-auto pr-1">
              {driversLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                </div>
              ) : driversError ? (
                <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-sm">
                  {driversError}
                </div>
              ) : drivers.length === 0 ? (
                <div className="p-6 rounded-xl bg-slate-50 text-slate-500 text-sm text-center">
                  <AlertTriangle className="w-5 h-5 mx-auto mb-2 text-amber-500" />
                  No drivers have opted in for outstation that match this
                  car type. Drivers enable this from their account screen.
                </div>
              ) : (
                drivers.map((d) => (
                  <DriverRow
                    key={d._id}
                    driver={d}
                    selected={String(selectedDriverId) === String(d._id)}
                    onSelect={() => setSelectedDriverId(d._id)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Notes */}
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

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-5 py-3 flex gap-3">
          <Button variant="outline" fullWidth onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            fullWidth
            loading={submitting}
            disabled={
              !selectedDriverId ||
              selectedDriver?.hasConflict ||
              hasVehicleConflict
            }
            onClick={handleAssign}
          >
            {hasVehicleConflict
              ? 'Vehicle conflict'
              : selectedDriver?.hasConflict
                ? 'Driver conflict'
                : 'Assign driver'}
          </Button>
        </div>
      </aside>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function DriverRow({ driver, selected, onSelect }) {
  const hasConflict = driver.hasConflict;
  const baseBorder = selected
    ? 'border-primary bg-primary/5'
    : hasConflict
      ? 'border-rose-200 bg-rose-50/40'
      : 'border-slate-200 hover:border-slate-300';

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left flex flex-col gap-2 p-3 rounded-2xl border transition ${baseBorder}`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold uppercase shrink-0 ${
            hasConflict
              ? 'bg-rose-100 text-rose-600'
              : 'bg-slate-100 text-slate-500'
          }`}
        >
          {driver.name?.charAt(0) || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-900 truncate">
              {driver.name}
            </p>
            {hasConflict && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded-full">
                <AlertTriangle className="w-2.5 h-2.5" />
                Conflict
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500 mt-0.5">
            <span className="inline-flex items-center gap-1">
              <Phone className="w-3 h-3" />
              {driver.phone || '—'}
            </span>
            <span className="inline-flex items-center gap-1">
              <Star className="w-3 h-3 text-amber-500" />
              {Number(driver.rating || 0).toFixed(1)}
            </span>
            <span>{driver.experienceYears || 0}y exp.</span>
            {driver.isOnline && (
              <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Online
              </span>
            )}
            {driver.isOnTrip && (
              <span className="inline-flex items-center gap-1 text-amber-600 font-semibold">
                On trip
              </span>
            )}
            {/* Picker already filters to opt-in drivers only, but we
                surface a tiny chip so the admin knows the list is
                pre-filtered (not "all approved drivers"). */}
            {driver.availableForOutstation && (
              <span className="inline-flex items-center gap-1 text-primary font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                Outstation
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Conflict list */}
      {hasConflict && (
        <div className="ml-13 pl-13 text-[11px] text-rose-700 space-y-1">
          {driver.conflicts.slice(0, 3).map((c) => (
            <div
              key={c._id}
              className="flex items-start gap-1.5 pl-12 pr-1 leading-snug"
            >
              <span className="inline-block w-1 h-1 rounded-full bg-rose-500 mt-1.5 shrink-0" />
              <span className="font-mono text-[10px] bg-rose-100 px-1.5 py-0.5 rounded">
                {c.bookingNumber || c._id.slice(-6)}
              </span>
              <span className="truncate">
                {formatDateTime12(c.startMs)} → {formatDateTime12(c.endMs)} ·{' '}
                {c.serviceType}/{c.bookingType}
              </span>
            </div>
          ))}
          {driver.conflicts.length > 3 && (
            <p className="pl-12 text-[10px] text-rose-600">
              +{driver.conflicts.length - 3} more
            </p>
          )}
        </div>
      )}
    </button>
  );
}

function ConflictBanner({ tone, title, subtitle, conflicts }) {
  const palette =
    tone === 'rose'
      ? 'border-rose-200 bg-rose-50 text-rose-800'
      : 'border-amber-200 bg-amber-50 text-amber-800';
  return (
    <div className={`rounded-2xl border ${palette} p-3 space-y-2`}>
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-bold">{title}</p>
          {subtitle && (
            <p className="text-[11px] leading-snug">{subtitle}</p>
          )}
        </div>
      </div>
      <ul className="text-[11px] space-y-1 pl-6 list-disc">
        {conflicts.slice(0, 5).map((c) => (
          <li key={c._id}>
            <span className="font-mono text-[10px] mr-1.5 bg-white/60 px-1 py-0.5 rounded">
              {c.bookingNumber || c._id.slice(-6)}
            </span>
            {formatPickupDateTime(c.startMs)} → {formatPickupDateTime(c.endMs)} ·{' '}
            {c.serviceType}/{c.bookingType}
          </li>
        ))}
        {conflicts.length > 5 && (
          <li className="list-none">+{conflicts.length - 5} more</li>
        )}
      </ul>
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

export default ManageOutstationAssignments;
