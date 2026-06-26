import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Banknote, Search, Check, X } from 'lucide-react';
import Card from '../../../components/Card';
import Button from '../../../components/Button';
import Input from '../../../components/Input';
import api from '../../../utils/api';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';

export default function ManageWithdrawals() {
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchWithdrawals();
  }, []);

  const fetchWithdrawals = async () => {
    try {
      const res = await api.get('/admin/withdrawals');
      setWithdrawals(res.data?.data?.withdrawals || []);
    } catch (err) {
      toast.error('Failed to load withdrawals');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id, action) => {
    try {
      await api.put(`/admin/withdrawals/${id}/${action}`);
      toast.success(`Withdrawal ${action}d successfully`);
      fetchWithdrawals();
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to ${action} withdrawal`);
    }
  };

  const filteredWithdrawals = withdrawals.filter(w => 
    w.driver?.name?.toLowerCase().includes(search.toLowerCase()) ||
    w.driver?.phone?.includes(search)
  );

  const columns = [
    {
      key: 'driver',
      label: 'Driver',
      render: (_, row) => (
        <div>
          <div className="font-medium">{row.driver?.name || 'Unknown'}</div>
          <div className="text-sm text-text-muted">{row.driver?.phone}</div>
        </div>
      ),
    },
    {
      key: 'amount',
      label: 'Amount (₹)',
      render: (_, row) => (
        <div className="font-semibold text-rose-600">
          ₹{row.amount}
        </div>
      ),
    },
    {
      key: 'bankDetails',
      label: 'Bank Details',
      render: (_, row) => (
        <div className="text-sm">
          <div><span className="text-text-muted">Bank:</span> {row.bankDetails?.bankName}</div>
          <div><span className="text-text-muted">A/C:</span> {row.bankDetails?.accountNumber}</div>
          <div><span className="text-text-muted">IFSC:</span> {row.bankDetails?.ifscCode}</div>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (_, row) => {
        const statusMap = {
          PENDING: 'warning',
          APPROVED: 'success',
          REJECTED: 'error',
        };
        return <StatusBadge status={row.status} type={statusMap[row.status] || 'default'} />;
      },
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
                Approve & Mark Paid
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                icon={X} 
                onClick={() => handleAction(row._id, 'reject')}
                className="text-red-600 border-red-600 hover:bg-red-50"
              >
                Reject & Refund
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
            <Banknote className="w-6 h-6 text-brand" />
            Withdrawal Requests
          </h1>
          <p className="text-text-muted mt-1">Manage driver wallet withdrawals</p>
        </div>
      </div>

      <Card className="p-4 flex flex-col sm:flex-row items-center gap-4">
        <Input
          icon={Search}
          placeholder="Search driver by name or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-96"
        />
      </Card>

      <Card className="overflow-hidden">
        <DataTable
          columns={columns}
          data={filteredWithdrawals}
          loading={loading}
          emptyMessage="No withdrawal requests found"
        />
      </Card>
    </div>
  );
}
