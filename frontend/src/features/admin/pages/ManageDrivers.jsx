import { useState, useEffect, useMemo } from 'react';
import Avatar from '../../../components/Avatar';
import { CAR_EXPERIENCE_TYPES } from '../../../utils/constants';
import api from '../../../utils/api';
import StatusBadge from '../components/StatusBadge';
import ServerPaginatedTable from '../components/ServerPaginatedTable';
import DriverStats from '../components/ManageDrivers/DriverStats';
import DriverFilters from '../components/ManageDrivers/DriverFilters';
import DriverReviewModal from '../components/ManageDrivers/DriverReviewModal';
import { isApprovalNoteValid } from '../components/ApprovalNoteForm';

const ManageDrivers = () => {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [approvalNote, setApprovalNote] = useState('');
  const [actionError, setActionError] = useState('');

  const fetchDrivers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page, limit });
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);

      const res = await api.get(`/admin/drivers?${params.toString()}`);

      if (res.data?.data?.data) {
        setDrivers(res.data.data.data);
        setPagination(res.data.data.pagination || { total: res.data.data.data.length, pages: 1 });
      } else if (Array.isArray(res.data?.data)) {
        setDrivers(res.data.data);
        setPagination({ total: res.data.data.length, pages: 1 });
      } else {
        setDrivers([]);
        setPagination({ total: 0, pages: 1 });
      }
    } catch (error) {
      console.error('Failed to fetch drivers', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchDrivers();
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [page, search, statusFilter]);

  const handleUpdateStatus = async (status) => {
    if (!selectedDriver) return;
    if (!isApprovalNoteValid(approvalNote)) {
      setActionError('Review note is required (minimum 10 characters).');
      throw new Error('Invalid note');
    }

    const driverId = selectedDriver._id;
    const trimmedNote = approvalNote.trim();

    try {
      await api.put(`/admin/drivers/${driverId}/status`, {
        approvalStatus: status,
        approvalNote: trimmedNote,
      });
      setDrivers((prev) =>
        prev.map((d) =>
          d._id === driverId ? { ...d, approvalStatus: status, approvalNote: trimmedNote } : d,
        ),
      );
      setSelectedDriver(null);
      setApprovalNote('');
      setActionError('');
    } catch (error) {
      console.error('Failed to update status', error);
      setActionError(error.response?.data?.message || 'Failed to update driver status');
      fetchDrivers();
      throw error;
    }
  };

  const openReview = (driver) => {
    setSelectedDriver(driver);
    setApprovalNote(driver.approvalNote || '');
    setActionError('');
  };

  const columns = useMemo(
    () => [
      {
        key: 'name',
        label: 'Driver',
        width: '30%',
        render: (val, row) => {
          const selfie = row.documents?.find((d) => d.type === 'selfie')?.fileUrl;
          return (
            <div className="flex items-center gap-4 py-1">
              <Avatar name={val} size="sm" src={selfie} className="ring-2 ring-white shadow-md" />
              <div>
                <p className="font-semibold text-sm text-slate-800">{val}</p>
                <p className="text-xs text-slate-500 mt-0.5">{row.phone}</p>
              </div>
            </div>
          );
        },
      },
      {
        key: 'approvalStatus',
        label: 'Status',
        render: (val) => <StatusBadge status={val} />,
      },
      {
        key: 'isOnline',
        label: 'Activity',
        width: '15%',
        className: 'hidden lg:table-cell',
        render: (val, row) => (
          <ActivityCell online={val} onTrip={row.isOnTrip} />
        ),
      },
      {
        key: 'carTypeExperience',
        label: 'Vehicle Experience',
        width: '30%',
        className: 'hidden xl:table-cell',
        render: (types) => (
          <div className="flex flex-wrap gap-1.5">
            {types?.map((typeId) => {
              const car = CAR_EXPERIENCE_TYPES.find((c) => c.id === typeId);
              return car ? (
                <span
                  key={typeId}
                  className="inline-flex items-center px-2 py-1 rounded-xl bg-slate-100 border border-slate-200 text-[11px] font-medium text-slate-700"
                >
                  {car.label}
                </span>
              ) : null;
            })}
          </div>
        ),
      },
      {
        key: 'actions',
        label: 'Action',
        sortable: false,
        width: '10%',
        render: (_, row) => (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openReview(row);
            }}
            className="px-4 py-2 rounded-xl bg-primary/10 text-primary text-xs font-semibold hover:bg-primary hover:text-white transition-all duration-300"
          >
            Review
          </button>
        ),
      },
    ],
    [],
  );

  const stats = useMemo(
    () => ({
      total: pagination.total,
      pending: drivers.filter((d) => d.approvalStatus === 'pending' || d.approvalStatus === 'under_review').length,
      approved: drivers.filter((d) => d.approvalStatus === 'approved').length,
      rejected: drivers.filter((d) => d.approvalStatus === 'rejected').length,
    }),
    [drivers, pagination.total],
  );

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-6 space-y-6 animate-fade-in-up">
      {actionError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {actionError}
        </div>
      )}

      <DriverFilters
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
      />

      <DriverStats {...stats} />

      <ServerPaginatedTable
        columns={columns}
        data={drivers}
        loading={loading}
        limit={limit}
        page={page}
        pagination={pagination}
        onPageChange={setPage}
        onRowClick={openReview}
        entityLabel="drivers"
      />

      <DriverReviewModal
        selectedDriver={selectedDriver}
        onClose={() => {
          setSelectedDriver(null);
          setApprovalNote('');
          setActionError('');
        }}
        approvalNote={approvalNote}
        onNoteChange={setApprovalNote}
        onUpdateStatus={handleUpdateStatus}
      />
    </div>
  );
};

function ActivityCell({ online, onTrip }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-2.5 h-2.5 rounded-full ${online ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
      <span className="text-xs font-medium text-slate-600">
        {online ? (onTrip ? 'On Trip' : 'Online') : 'Offline'}
      </span>
    </div>
  );
}

export default ManageDrivers;
