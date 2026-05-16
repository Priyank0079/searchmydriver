import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Avatar from '../../../components/Avatar';
import api from '../../../utils/api';
import ServerPaginatedTable from '../components/ServerPaginatedTable';
import UserFilters from '../components/ManageUsers/UserFilters';
import UserStats from '../components/ManageUsers/UserStats';

const ManageUsers = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page, limit });
      if (search) params.append('search', search);

      const res = await api.get(`/admin/users?${params.toString()}`);
      const payload = res.data?.data;

      if (payload?.data) {
        setUsers(payload.data);
        setPagination(payload.pagination || { total: payload.data.length, pages: 1 });
      } else {
        setUsers([]);
        setPagination({ total: 0, pages: 1 });
      }
    } catch (error) {
      console.error('Failed to fetch users', error);
      setUsers([]);
      setPagination({ total: 0, pages: 1 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(fetchUsers, 300);
    return () => clearTimeout(timer);
  }, [page, search]);

  const columns = useMemo(
    () => [
      {
        key: 'name',
        label: 'User',
        width: '34%',
        render: (val, row) => (
          <div className="flex items-center gap-3 py-1">
            <Avatar name={val} size="sm" src={row.profilePicture} />
            <div>
              <p className="font-semibold text-sm text-slate-800">{val}</p>
              <p className="text-xs text-slate-500 mt-0.5">{row.email}</p>
            </div>
          </div>
        ),
      },
      {
        key: 'phone_no',
        label: 'Phone',
        width: '20%',
        render: (val) => <span className="text-sm text-slate-600">{val || '—'}</span>,
      },
      {
        key: 'carsCount',
        label: 'Vehicles',
        width: '16%',
        render: (val) => (
          <span
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
              val > 0 ? 'bg-primary/10 text-primary-dark' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {val} {val === 1 ? 'car' : 'cars'}
          </span>
        ),
      },
      {
        key: 'isActive',
        label: 'Status',
        width: '14%',
        render: (val) => (
          <span
            className={`text-xs font-semibold ${val ? 'text-emerald-600' : 'text-rose-600'}`}
          >
            {val ? 'Active' : 'Inactive'}
          </span>
        ),
      },
      {
        key: 'createdAt',
        label: 'Joined',
        width: '16%',
        className: 'hidden md:table-cell',
        render: (val) => (
          <span className="text-xs text-slate-500">
            {val ? new Date(val).toLocaleDateString() : '—'}
          </span>
        ),
      },
    ],
    [],
  );

  const stats = useMemo(
    () => ({
      total: pagination.total,
      withCars: users.filter((u) => u.carsCount > 0).length,
    }),
    [users, pagination.total],
  );

  return (
    <div className="min-h-screen bg-slate-50 space-y-6 animate-fade-in-up">
      <UserFilters search={search} onSearchChange={(val) => { setSearch(val); setPage(1); }} />
      <UserStats {...stats} />

      <ServerPaginatedTable
        columns={columns}
        data={users}
        loading={loading}
        limit={limit}
        page={page}
        pagination={pagination}
        onPageChange={setPage}
        onRowClick={(row) => navigate(`/admin/users/${row._id}/profile`)}
        entityLabel="users"
        emptyMessage="No users found"
      />
    </div>
  );
};

export default ManageUsers;
