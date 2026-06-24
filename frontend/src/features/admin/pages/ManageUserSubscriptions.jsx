import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Sparkles,
  MapPin,
  User as UserIcon,
  Phone,
  Search,
  RefreshCw,
  Loader2,
  AlertTriangle,
  ChevronDown,
  UserCheck,
  UserMinus,
  Star,
  CalendarRange,
  Filter,
} from 'lucide-react';
import Card from '../../../components/Card';
import Button from '../../../components/Button';
import Badge from '../../../components/Badge';
import Drawer from '../../../components/Drawer';
import ServerPaginatedTable from '../components/ServerPaginatedTable';
import api from '../../../utils/api';
import useAdminAuthStore from '../../../store/useAdminAuthStore';
import { useAdminZonesStore } from '../../../store/admin/useAdminZonesStore';
import { SUBSCRIPTION_ASSIGNMENT_STATUS } from '../../../constants/serviceTypes';
import { formatDateTime12 } from '../../../utils/datetime';

const OPERATIONS_ROLES = new Set(['admin', 'sub_admin']);

const ASSIGNMENT_FILTERS = [
  { value: '', label: 'All statuses' },
  { value: SUBSCRIPTION_ASSIGNMENT_STATUS.PENDING, label: 'Pending driver' },
  { value: SUBSCRIPTION_ASSIGNMENT_STATUS.ASSIGNED, label: 'Driver assigned' },
  { value: SUBSCRIPTION_ASSIGNMENT_STATUS.RELEASED, label: 'Released' },
];

const ManageUserSubscriptions = () => {
  const admin = useAdminAuthStore((s) => s.admin);
  const canAssign = OPERATIONS_ROLES.has(admin?.role);

  const fetchZones = useAdminZonesStore((s) => s.fetch);
  const zonesEntry = useAdminZonesStore((s) => s.getEntry('admin-zones'));
  const zones = useMemo(
    () => (Array.isArray(zonesEntry?.data) ? zonesEntry.data : []),
    [zonesEntry],
  );

  useEffect(() => {
    fetchZones?.('admin-zones', {}).catch(() => {});
  }, [fetchZones]);

  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [filters, setFilters] = useState({ zoneId: '', assignmentStatus: '' });
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [assignRow, setAssignRow] = useState(null);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit });
      if (filters.zoneId) params.append('zoneId', filters.zoneId);
      if (filters.assignmentStatus) params.append('assignmentStatus', filters.assignmentStatus);
      const res = await api.get(`/admin/subscriptions/users?${params.toString()}`);
      const data = res?.data?.data || {};
      setRows(data.items || []);
      setPagination({
        total: data.total || 0,
        pages: Math.max(1, Math.ceil((data.total || 0) / limit)),
      });
      setError(null);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load subscription requests');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, limit, filters]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const pendingCount = useMemo(
    () => rows.filter((r) => r.assignmentStatus === SUBSCRIPTION_ASSIGNMENT_STATUS.PENDING).length,
    [rows],
  );

  const columns = useMemo(() => [
    {
      key: 'customer',
      header: 'Customer',
      render: (_, row) => (
        <div className="min-w-0">
          <p className="font-semibold text-slate-800 truncate">{row.userId?.name || '—'}</p>
          <p className="text-xs text-slate-500">{row.userId?.phone_no || row.userId?.email || '—'}</p>
        </div>
      ),
    },
    {
      key: 'plan',
      header: 'Plan',
      render: (_, row) => (
        <div className="min-w-0">
          <p className="font-medium text-slate-800">{row.planNameSnapshot || row.planId?.name || '—'}</p>
          <p className="text-xs text-slate-500">
            ₹{row.amount} · {row.durationMonths} mo
            {row.includedHoursPerDay === 0
              ? ' · full-time'
              : ` · ${row.includedHoursPerDay}h/day`}
          </p>
        </div>
      ),
    },
    {
      key: 'zone',
      header: 'Zone',
      render: (_, row) => (
        <span className="inline-flex items-center gap-1 text-sm text-slate-600">
          <MapPin className="w-3.5 h-3.5 shrink-0" />
          {row.zoneId?.name || '—'}
          {row.zoneId?.city ? ` · ${row.zoneId.city}` : ''}
        </span>
      ),
    },
    {
      key: 'period',
      header: 'Period',
      render: (_, row) => (
        <div className="text-xs text-slate-600">
          <p>{row.startDate ? formatDateTime12(row.startDate) : '—'}</p>
          <p className="text-slate-400">to {row.expiryDate ? formatDateTime12(row.expiryDate) : '—'}</p>
        </div>
      ),
    },
    {
      key: 'driver',
      header: 'Driver',
      render: (_, row) => {
        if (row.assignedDriverId) {
          return (
            <div className="min-w-0">
              <p className="font-medium text-slate-800">{row.assignedDriverId.name}</p>
              <p className="text-xs text-slate-500">{row.assignedDriverId.phone || '—'}</p>
            </div>
          );
        }
        return <Badge variant="warning">Pending</Badge>;
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (_, row) => {
        const variant =
          row.assignmentStatus === SUBSCRIPTION_ASSIGNMENT_STATUS.ASSIGNED
            ? 'success'
            : row.assignmentStatus === SUBSCRIPTION_ASSIGNMENT_STATUS.RELEASED
              ? 'default'
              : 'warning';
        return <Badge variant={variant}>{row.assignmentStatus || 'pending'}</Badge>;
      },
    },
    {
      key: 'actions',
      header: '',
      render: (_, row) => (
        canAssign ? (
          <Button
            size="sm"
            variant={row.assignedDriverId ? 'outline' : 'primary'}
            onClick={(e) => {
              e.stopPropagation();
              setAssignRow(row);
            }}
          >
            {row.assignedDriverId ? 'Reassign' : 'Assign'}
          </Button>
        ) : null
      ),
    },
  ], [canAssign]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            Subscription Requests
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Paid subscriptions waiting for a dedicated driver, zone-wise.
          </p>
        </div>
        <Button variant="outline" onClick={fetchQueue} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatTile
          label="Total (this page)"
          value={rows.length}
          desc="Active paid subscriptions"
          icon={Sparkles}
        />
        <StatTile
          label="Pending driver"
          value={pendingCount}
          desc="Need assignment on this page"
          icon={UserCheck}
          accent="amber"
        />
        <StatTile
          label="All zones"
          value={pagination.total}
          desc="Matching current filters"
          icon={CalendarRange}
        />
      </div>

      <Card padding="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <select
              value={filters.assignmentStatus}
              onChange={(e) => {
                setFilters((f) => ({ ...f, assignmentStatus: e.target.value }));
                setPage(1);
              }}
              className="w-full h-10 pl-9 pr-8 text-sm rounded-xl border border-slate-200 bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              {ASSIGNMENT_FILTERS.map((opt) => (
                <option key={opt.value || 'all'} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <select
              value={filters.zoneId}
              onChange={(e) => {
                setFilters((f) => ({ ...f, zoneId: e.target.value }));
                setPage(1);
              }}
              className="w-full h-10 pl-9 pr-8 text-sm rounded-xl border border-slate-200 bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value="">All zones</option>
              {zones.map((z) => (
                <option key={z._id} value={z._id}>
                  {z.name}{z.city ? ` · ${z.city}` : ''}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </Card>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
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
        onRowClick={canAssign ? (row) => setAssignRow(row) : undefined}
        entityLabel="subscriptions"
        emptyMessage="No subscription requests match these filters."
      />

      {assignRow && (
        <AssignSubscriptionDrawer
          subscription={assignRow}
          onClose={() => setAssignRow(null)}
          onUpdated={() => {
            setAssignRow(null);
            fetchQueue();
          }}
        />
      )}
    </div>
  );
};

function StatTile({ label, value, desc, icon: Icon, accent }) {
  const accentClass = accent === 'amber' ? 'text-amber-600 bg-amber-100' : 'text-primary bg-primary/15';
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${accentClass}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-3xl font-extrabold text-slate-900 leading-none">{value}</p>
        <p className="text-[11px] font-bold text-slate-600 mt-1">{label}</p>
        <p className="text-[10px] text-slate-400 mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

export function AssignSubscriptionDrawer({ subscription, onClose, onUpdated }) {
  const [drivers, setDrivers] = useState([]);
  const [driversLoading, setDriversLoading] = useState(true);
  const [driversError, setDriversError] = useState(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState(null);
  const [releaseReason, setReleaseReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setDriversLoading(true);
    setDrivers([]);
    const params = new URLSearchParams({ limit: 50, page: 1 });
    if (debouncedSearch) params.append('search', debouncedSearch);
    api
      .get(`/admin/subscriptions/users/${subscription._id}/available-drivers?${params}`)
      .then((res) => {
        if (!cancelled) {
          setDrivers(res?.data?.data?.drivers || []);
          setDriversError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setDriversError(err?.response?.data?.message || 'Failed to load drivers');
        }
      })
      .finally(() => {
        if (!cancelled) setDriversLoading(false);
      });
    return () => { cancelled = true; };
  }, [subscription._id, debouncedSearch]);

  const selectedDriver = useMemo(
    () => drivers.find((d) => String(d._id) === String(selectedDriverId)) || null,
    [drivers, selectedDriverId],
  );

  const handleAssign = async () => {
    if (!selectedDriverId) {
      toast.error('Pick a driver first');
      return;
    }
    if (selectedDriver?.hasConflict) {
      toast.error('This driver has a scheduling conflict. Pick another.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/admin/subscriptions/users/${subscription._id}/assign`, {
        driverId: selectedDriverId,
      });
      toast.success('Driver assigned successfully');
      onUpdated();
    } catch (err) {
      const data = err?.response?.data;
      toast.error(data?.message || 'Could not assign driver');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRelease = async () => {
    if (!subscription.assignedDriverId) return;
    setSubmitting(true);
    try {
      await api.post(`/admin/subscriptions/users/${subscription._id}/release`, {
        reason: releaseReason.trim() || 'Released by admin',
      });
      toast.success('Driver released');
      onUpdated();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not release driver');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Drawer
      isOpen
      onClose={() => !submitting && onClose()}
      header={(
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">Assign dedicated driver</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {subscription.planNameSnapshot || subscription.planId?.name || 'Subscription'}
          </p>
        </div>
      )}
    >
      <div className="p-5 space-y-4">
        <div className="rounded-2xl bg-slate-50 p-4 text-sm space-y-2">
          <div className="flex items-center gap-2 text-slate-700">
            <UserIcon className="w-4 h-4" />
            <span className="font-semibold">{subscription.userId?.name || 'Customer'}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-600">
            <MapPin className="w-4 h-4" />
            {subscription.zoneId?.name || 'Zone'}
            {subscription.zoneId?.city ? ` · ${subscription.zoneId.city}` : ''}
          </div>
          {subscription.assignedDriverId && (
            <div className="flex items-center gap-2 text-emerald-700">
              <UserCheck className="w-4 h-4" />
              Current: {subscription.assignedDriverId.name}
            </div>
          )}
        </div>

        {subscription.assignedDriverId && (
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Release reason (optional, for reassignment)
            </label>
            <textarea
              value={releaseReason}
              onChange={(e) => setReleaseReason(e.target.value)}
              rows={2}
              placeholder="e.g. Driver on leave for 3 days"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              disabled={submitting}
              onClick={handleRelease}
            >
              <UserMinus className="w-4 h-4 mr-1" />
              Release current driver
            </Button>
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search drivers by name or phone"
            className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {driversError && (
          <p className="text-sm text-rose-600">{driversError}</p>
        )}

        <div className="max-h-72 overflow-y-auto space-y-2">
          {driversLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : drivers.length === 0 ? (
            <div className="text-center py-8 px-4 rounded-xl border border-slate-100 bg-slate-50/50">
              <p className="text-sm font-medium text-slate-700">No drivers available</p>
              <p className="text-xs text-slate-500 mt-1">
                {debouncedSearch ? 'Try a different search term.' : 'There are no approved drivers in the system to assign.'}
              </p>
            </div>
          ) : (
            drivers.map((driver) => {
              const active = String(selectedDriverId) === String(driver._id);
              return (
                <button
                  key={driver._id}
                  type="button"
                  disabled={driver.hasConflict}
                  onClick={() => setSelectedDriverId(driver._id)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    driver.hasConflict
                      ? 'border-rose-100 bg-rose-50/50 opacity-70 cursor-not-allowed'
                      : active
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                        : 'border-slate-200 bg-white hover:border-primary/30'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{driver.name}</p>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3" />
                        {driver.phone || '—'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-amber-600 shrink-0">
                      <Star className="w-3 h-3 fill-current" />
                      {Number(driver.rating || 0).toFixed(1)}
                    </div>
                  </div>
                  {driver.hasConflict && (
                    <p className="text-[10px] text-rose-600 mt-2 font-medium">
                      {driver.hasSubscriptionConflict
                        ? 'Already on another subscription in this period'
                        : `Overlapping booking${driver.conflicts?.length === 1 ? '' : 's'}`}
                    </p>
                  )}
                </button>
              );
            })
          )}
        </div>

        <Button
          fullWidth
          disabled={!selectedDriverId || submitting || selectedDriver?.hasConflict}
          onClick={handleAssign}
        >
          {submitting ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Assigning…
            </span>
          ) : (
            subscription.assignedDriverId ? 'Reassign driver' : 'Assign driver'
          )}
        </Button>
      </div>
    </Drawer>
  );
}

export default ManageUserSubscriptions;
