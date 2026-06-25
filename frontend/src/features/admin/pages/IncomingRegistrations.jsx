import { useState, useMemo } from 'react';
import { RefreshCw, Users, Car } from 'lucide-react';
import Avatar from '../../../components/Avatar';
import { useCachedQuery } from '../../../hooks/useCachedQuery';
import { buildCacheKey } from '../../../store/lib/buildCacheKey';
import { useAdminIncomingRegistrationsStore } from '../../../store/admin/useAdminIncomingRegistrationsStore';
import ServerPaginatedTable from '../components/ServerPaginatedTable';

const IncomingRegistrations = () => {
  const [activeTab, setActiveTab] = useState('drivers'); // 'drivers' | 'users'
  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  const queryParams = useMemo(() => ({ page, limit }), [page, limit]);
  const cacheKey = buildCacheKey('admin-incoming-registrations', queryParams);

  const { data, loading, error, refetch } = useCachedQuery(
    useAdminIncomingRegistrationsStore,
    cacheKey,
    queryParams,
  );

  const drivers = data?.drivers?.data ?? [];
  const driversPagination = data?.drivers?.pagination ?? { total: 0, pages: 1 };

  const users = data?.users?.data ?? [];
  const usersPagination = data?.users?.pagination ?? { total: 0, pages: 1 };

  const driverColumns = useMemo(
    () => [
      {
        key: 'name',
        label: 'Driver',
        width: '35%',
        render: (val, row) => (
          <div className="flex items-center gap-3 py-1">
            <Avatar name={val || 'No Name'} size="sm" src={row.profilePicture} />
            <div>
              <p className="font-semibold text-sm text-slate-800">{val || 'No Name'}</p>
              <p className="text-xs text-slate-500 mt-0.5">{row.phone || 'No Phone'}</p>
            </div>
          </div>
        ),
      },
      {
        key: 'onboardingStep',
        label: 'Step',
        width: '15%',
        render: (val) => (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-primary/10 text-primary-dark">
            Step {val} / 6
          </span>
        ),
      },
      {
        key: 'approvalStatus',
        label: 'Status',
        width: '20%',
        render: (val) => (
          <span
            className={`text-xs font-semibold ${
              val === 'pending' ? 'text-amber-600' : 'text-slate-600'
            }`}
          >
            {val ? val.toUpperCase() : 'UNKNOWN'}
          </span>
        ),
      },
      {
        key: 'createdAt',
        label: 'Started At',
        width: '30%',
        render: (val) => (
          <span className="text-xs text-slate-500">
            {val ? new Date(val).toLocaleString() : '—'}
          </span>
        ),
      },
    ],
    [],
  );

  const userColumns = useMemo(
    () => [
      {
        key: 'name',
        label: 'User',
        width: '35%',
        render: (val, row) => (
          <div className="flex items-center gap-3 py-1">
            <Avatar name={val || 'No Name'} size="sm" src={row.profilePicture} />
            <div>
              <p className="font-semibold text-sm text-slate-800">{val || 'No Name'}</p>
              <p className="text-xs text-slate-500 mt-0.5">{row.phone_no || 'No Phone'}</p>
            </div>
          </div>
        ),
      },
      {
        key: 'isPhoneVerified',
        label: 'Phone Verified',
        width: '20%',
        render: (val) => (
          <span
            className={`text-xs font-semibold ${
              val ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {val ? 'Yes' : 'No'}
          </span>
        ),
      },
      {
        key: 'carsCount',
        label: 'Cars',
        width: '15%',
        render: (val) => (
          <span
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
              val > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
            }`}
          >
            {val}
          </span>
        ),
      },
      {
        key: 'createdAt',
        label: 'Started At',
        width: '30%',
        render: (val) => (
          <span className="text-xs text-slate-500">
            {val ? new Date(val).toLocaleString() : '—'}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <div className="min-h-screen bg-slate-50 space-y-6 animate-fade-in-up pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Incoming Registrations</h1>
          <p className="text-sm text-slate-500 mt-1">
            Monitor users and drivers who haven't completed their onboarding or registration.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex p-1 bg-white border border-slate-200 rounded-xl w-fit">
        <button
          onClick={() => {
            setActiveTab('drivers');
            setPage(1);
          }}
          className={`flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg transition-colors ${
            activeTab === 'drivers'
              ? 'bg-primary/10 text-primary'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Car className="w-4 h-4" />
          Incomplete Drivers
        </button>
        <button
          onClick={() => {
            setActiveTab('users');
            setPage(1);
          }}
          className={`flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg transition-colors ${
            activeTab === 'users'
              ? 'bg-primary/10 text-primary'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Users className="w-4 h-4" />
          Incomplete Users
        </button>
      </div>

      {activeTab === 'drivers' ? (
        <ServerPaginatedTable
          columns={driverColumns}
          data={drivers}
          loading={loading}
          limit={limit}
          page={page}
          pagination={driversPagination}
          onPageChange={setPage}
          entityLabel="incomplete drivers"
          emptyMessage="All drivers have completed registration!"
        />
      ) : (
        <ServerPaginatedTable
          columns={userColumns}
          data={users}
          loading={loading}
          limit={limit}
          page={page}
          pagination={usersPagination}
          onPageChange={setPage}
          entityLabel="incomplete users"
          emptyMessage="All users have completed registration!"
        />
      )}
    </div>
  );
};

export default IncomingRegistrations;
