import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Sparkles,
  RefreshCw,
  Search,
  Loader2,
  Banknote,
  TrendingUp,
  Users,
} from 'lucide-react';
import Badge from '../../../components/Badge';
import Card from '../../../components/Card';
import ServerPaginatedTable from '../components/ServerPaginatedTable';
import api from '../../../utils/api';
import { formatCurrency } from '../../../utils/fareCalculator';
import { formatDateTime12 } from '../../../utils/datetime';

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const ManageSubscriptionRevenue = () => {
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState(null);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit });
      if (search) params.append('search', search);
      if (from) params.append('from', from);
      if (to) params.append('to', to);
      const res = await api.get(`/admin/subscriptions/revenue?${params}`);
      const data = res?.data?.data || {};
      setRows(data.items || []);
      setTotals(data.totals || null);
      setPagination({
        total: data.total || 0,
        pages: Math.max(1, Math.ceil((data.total || 0) / limit)),
      });
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, from, to]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const columns = useMemo(
    () => [
      {
        key: 'customer',
        header: 'Customer',
        render: (row) => (
          <div>
            <p className="font-semibold text-slate-800">{row.userId?.name || '—'}</p>
            <p className="text-xs text-slate-500">{row.userId?.phone_no || '—'}</p>
          </div>
        ),
      },
      {
        key: 'plan',
        header: 'Plan',
        render: (row) => (
          <div>
            <p className="font-medium">{row.planNameSnapshot || '—'}</p>
            <p className="text-xs text-slate-500">{row.zoneId?.name || '—'}</p>
          </div>
        ),
      },
      {
        key: 'paid',
        header: 'Paid at',
        render: (row) => (
          <span className="text-xs text-slate-600">{formatDateTime12(row.paidAt)}</span>
        ),
      },
      {
        key: 'collected',
        header: 'Collected',
        render: (row) => <span className="font-semibold">{formatCurrency(row.amount)}</span>,
      },
      {
        key: 'platform',
        header: 'Platform',
        render: (row) => formatCurrency(row.platformShareRupees),
      },
      {
        key: 'driver',
        header: 'Driver share',
        render: (row) => (
          <div>
            <p>{formatCurrency(row.driverShareRupees)}</p>
            {row.driverSharePaidAt ? (
              <Badge variant="success">Paid to driver</Badge>
            ) : (
              <Badge variant="warning">Pending assign</Badge>
            )}
          </div>
        ),
      },
      {
        key: 'driverName',
        header: 'Assigned driver',
        render: (row) => row.assignedDriverId?.name || row.driverSharePaidTo?.name || '—',
      },
    ],
    [],
  );

  const summary = [
    { label: 'Total collected', value: formatCurrency(totals?.totalCollected), icon: Banknote },
    { label: 'Platform share', value: formatCurrency(totals?.totalPlatform), icon: TrendingUp },
    { label: 'Driver share', value: formatCurrency(totals?.totalDriver), icon: Users },
    { label: 'Subscriptions', value: totals?.count ?? 0, icon: Sparkles },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            Subscription Revenue
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Paid subscriptions with platform vs driver revenue split.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchData}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium hover:bg-slate-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {summary.map((s) => (
          <Card key={s.label} padding="p-4">
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className="text-xl font-extrabold text-slate-900 mt-1">{s.value}</p>
          </Card>
        ))}
      </div>

      <Card padding="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search plan name"
              className="w-full h-10 pl-9 pr-3 rounded-xl border text-sm"
            />
          </div>
          <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="h-10 px-3 rounded-xl border text-sm" />
          <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="h-10 px-3 rounded-xl border text-sm" />
        </div>
      </Card>

      <ServerPaginatedTable
        columns={columns}
        data={rows}
        loading={loading}
        page={page}
        limit={limit}
        pagination={pagination}
        onPageChange={setPage}
        entityLabel="subscriptions"
        emptyMessage="No paid subscriptions in this range."
      />
    </div>
  );
};

export default ManageSubscriptionRevenue;
