import { useState, useMemo, useEffect } from 'react';
import Badge from '../../../components/Badge';
import { useCachedQuery } from '../../../hooks/useCachedQuery';
import { buildCacheKey } from '../../../store/lib/buildCacheKey';
import { useAdminBookingsStore } from '../../../store/admin/useAdminBookingsStore';
import ServerPaginatedTable from '../components/ServerPaginatedTable';
import BookingDetailsModal from '../components/ManageBookings/BookingDetailsModal';
import BookingFilters from '../components/ManageBookings/BookingFilters';
import BookingStats from '../components/ManageBookings/BookingStats';

const ManageBookings = () => {
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedBooking, setSelectedBooking] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const queryParams = useMemo(
    () => ({ page, limit, search: debouncedSearch, status: statusFilter }),
    [page, limit, debouncedSearch, statusFilter],
  );

  const cacheKey = buildCacheKey('admin-bookings', queryParams);

  const { data, loading, error, refetch } = useCachedQuery(
    useAdminBookingsStore,
    cacheKey,
    queryParams,
  );

  const bookings = data?.bookings ?? [];
  const pagination = data?.pagination ?? { total: 0, pages: 1 };

  const columns = useMemo(
    () => [
      {
        key: 'id',
        label: 'Booking ID',
        width: '15%',
        render: (val, row) => (
          <span className="font-mono font-medium text-xs bg-gray-100 px-2 py-1 rounded">
            {row.bookingNumber || row._id.slice(-6)}
          </span>
        ),
      },
      {
        key: 'user',
        label: 'Customer',
        width: '20%',
        render: (val, row) => (
          <span className="font-semibold text-sm">
            {row.userId ? row.userId.name : 'Unknown'}
          </span>
        ),
      },
      {
        key: 'driver',
        label: 'Assigned Driver',
        width: '20%',
        render: (val, row) =>
          row.driverId ? (
            <span className="text-sm">{row.driverId.name}</span>
          ) : (
            <span className="text-xs text-slate-400 italic">Unassigned</span>
          ),
      },
      {
        key: 'serviceType',
        label: 'Service',
        width: '15%',
        render: (val, row) => <span className="capitalize">{row.serviceType}</span>,
      },
      {
        key: 'fare',
        label: 'Est. Fare',
        width: '10%',
        render: (val, row) => (
          <span className="font-medium text-emerald-600">
            ₹{row.fareSnapshot?.total || 0}
          </span>
        ),
      },
      {
        key: 'status',
        label: 'Status',
        width: '10%',
        render: (val, row) => {
          const variants = {
            completed: 'success',
            started: 'primary',
            driver_assigned: 'primary',
            arrived: 'primary',
            searching: 'warning',
            cancelled: 'danger',
          };
          return (
            <Badge variant={variants[row.status] || 'default'} className="capitalize">
              {row.status?.replace(/_/g, ' ')}
            </Badge>
          );
        },
      },
      {
        key: 'createdAt',
        label: 'Date',
        width: '10%',
        render: (val, row) => (
          <span className="text-sm text-slate-500">
            {new Date(row.createdAt).toLocaleDateString()}
          </span>
        ),
      },
    ],
    [],
  );

  const stats = data?.stats ?? {
    total: 0,
    searching: 0,
    active: 0,
    completed: 0,
    cancelled: 0,
  };

  return (
    <div className="min-h-screen bg-slate-50 space-y-6 animate-fade-in-up">
      <BookingFilters
        search={search}
        onSearchChange={(val) => {
          setSearch(val);
          setPage(1);
        }}
        statusFilter={statusFilter}
        onStatusChange={(val) => {
          setStatusFilter(val);
          setPage(1);
        }}
        onRefresh={refetch}
        refreshing={loading}
      />

      <BookingStats {...stats} />

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <ServerPaginatedTable
        columns={columns}
        data={bookings}
        loading={loading}
        limit={limit}
        page={page}
        pagination={pagination}
        onPageChange={setPage}
        onRowClick={(row) => setSelectedBooking(row)}
        entityLabel="bookings"
        emptyMessage="No bookings found"
      />

      <BookingDetailsModal
        isOpen={!!selectedBooking}
        onClose={() => setSelectedBooking(null)}
        booking={selectedBooking}
      />
    </div>
  );
};

export default ManageBookings;
