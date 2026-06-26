import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Users, Search, Check, X, HandCoins } from 'lucide-react';
import Card from '../../../components/Card';
import Button from '../../../components/Button';
import Input from '../../../components/Input';
import api from '../../../utils/api';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';

export default function ManageReferrals() {
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchReferrals();
  }, []);

  const fetchReferrals = async () => {
    try {
      const res = await api.get('/admin/referrals');
      setReferrals(res.data?.data?.referrals || []);
    } catch (err) {
      toast.error('Failed to load referrals');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id, action) => {
    try {
      await api.put(`/admin/referrals/${id}/${action}`);
      toast.success(`Referral ${action}d successfully`);
      fetchReferrals();
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to ${action} referral`);
    }
  };

  const filteredReferrals = referrals.filter(r => 
    r.referrer?.name?.toLowerCase().includes(search.toLowerCase()) ||
    r.referrer?.phone?.includes(search) ||
    r.referredUser?.name?.toLowerCase().includes(search.toLowerCase()) ||
    r.referredDriver?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    {
      key: 'referrer',
      label: 'Referrer',
      render: (_, row) => (
        <div>
          <div className="font-medium">{row.referrer?.name || 'Unknown'}</div>
          <div className="text-sm text-text-muted">{row.referrer?.phone}</div>
          <div className="text-xs uppercase bg-brand-light/20 text-brand px-2 py-0.5 rounded inline-block mt-1">
            {row.referrerRole}
          </div>
        </div>
      ),
    },
    {
      key: 'referredPerson',
      label: 'Referred Person',
      render: (_, row) => {
        const person = row.referredUser || row.referredDriver;
        if (!person) return 'Unknown';
        return (
          <div>
            <div className="font-medium">{person.name || 'Unknown'}</div>
            <div className="text-sm text-text-muted">{person.phone}</div>
            <div className="text-xs uppercase bg-blue-500/10 text-blue-600 px-2 py-0.5 rounded inline-block mt-1">
              {row.referredRole}
            </div>
          </div>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (_, row) => {
        const statusMap = {
          PENDING: 'warning',
          SUCCESSFUL: 'success',
          REJECTED: 'error',
        };
        return <StatusBadge status={row.status} type={statusMap[row.status] || 'default'} />;
      },
    },
    {
      key: 'reward',
      label: 'Reward (₹)',
      render: (_, row) => (
        <div className="font-semibold text-emerald-600">
          ₹{row.rewardAmount}
        </div>
      ),
    },
    {
      key: 'date',
      label: 'Date',
      render: (_, row) => new Date(row.createdAt).toLocaleDateString(),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex items-center gap-2">
          {row.status === 'PENDING' && (
            <>
              <Button 
                variant="outline" 
                size="sm" 
                icon={Check} 
                onClick={() => handleAction(row._id, 'approve')}
                className="text-emerald-600 border-emerald-600 hover:bg-emerald-50"
              >
                Approve
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                icon={X} 
                onClick={() => handleAction(row._id, 'reject')}
                className="text-red-600 border-red-600 hover:bg-red-50"
              >
                Reject
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6 text-brand" />
            Referrals List
          </h1>
          <p className="text-text-muted mt-1">Manage user and driver referrals</p>
        </div>
      </div>

      <Card className="p-4 flex flex-col sm:flex-row items-center gap-4">
        <Input
          icon={Search}
          placeholder="Search by name or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-96"
        />
      </Card>

      <Card className="overflow-hidden">
        <DataTable
          columns={columns}
          data={filteredReferrals}
          loading={loading}
          emptyMessage="No referrals found"
        />
      </Card>
    </div>
  );
}
