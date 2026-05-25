import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Banknote,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  RefreshCw,
  Search,
  ExternalLink,
} from 'lucide-react';
import Badge from '../../../components/Badge';
import ConfirmDialog from '../../../components/ConfirmDialog';
import useAdminRefundsStore from '../../../store/admin/useAdminRefundsStore';

/**
 * Admin → Account → Refunds.
 *
 * Renders the Refund ledger produced by the cancellation pipeline.
 * Refunds are NEVER moved automatically — the admin processes each one
 * manually on the Razorpay dashboard, then comes back here to mark it
 * `processed` (with the gateway refund id) or `failed` (with a note).
 *
 *   • Server-side pagination + filters live in `useAdminRefundsStore`.
 *   • The two action buttons render only for `pending` rows; once a
 *     refund is processed or failed, the row becomes read-only.
 *   • Summary cards re-fetch on every status flip so the totals stay
 *     in sync with the rows.
 */

const STATUS_META = {
  pending: { label: 'Pending', variant: 'warning', icon: Clock },
  processed: { label: 'Processed', variant: 'success', icon: CheckCircle2 },
  failed: { label: 'Failed', variant: 'danger', icon: XCircle },
};

function formatCurrency(amount) {
  const n = Number(amount) || 0;
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function formatDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const ManageRefunds = () => {
  const refunds = useAdminRefundsStore((s) => s.refunds);
  const totals = useAdminRefundsStore((s) => s.totals);
  const loading = useAdminRefundsStore((s) => s.loading);
  const error = useAdminRefundsStore((s) => s.error);
  const page = useAdminRefundsStore((s) => s.page);
  const limit = useAdminRefundsStore((s) => s.limit);
  const total = useAdminRefundsStore((s) => s.total);
  const filters = useAdminRefundsStore((s) => s.filters);
  const updatingId = useAdminRefundsStore((s) => s.updatingId);
  const fetchRefunds = useAdminRefundsStore((s) => s.fetchRefunds);
  const setFilter = useAdminRefundsStore((s) => s.setFilter);
  const setPage = useAdminRefundsStore((s) => s.setPage);
  const updateRefundStatus = useAdminRefundsStore((s) => s.updateRefundStatus);

  // Modal state for the two manual actions. `target.action` is either
  // 'processed' (admin moved money on Razorpay) or 'failed' (couldn't
  // process). `note` doubles as the razorpayRefundId / error blurb.
  const [actionTarget, setActionTarget] = useState(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    fetchRefunds().catch(() => {});
  }, [fetchRefunds]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const summaryCards = useMemo(
    () => [
      {
        label: 'Total ledger',
        value: formatCurrency(totals?.totalAmount || 0),
        icon: Banknote,
        accent: 'text-primary',
      },
      {
        label: 'Processed',
        value: totals?.byStatus?.processed?.count || 0,
        icon: CheckCircle2,
        accent: 'text-green-700',
      },
      {
        label: 'Pending',
        value: totals?.byStatus?.pending?.count || 0,
        icon: Clock,
        accent: 'text-amber-700',
      },
      {
        label: 'Failed',
        value: totals?.byStatus?.failed?.count || 0,
        icon: XCircle,
        accent: 'text-danger',
      },
    ],
    [totals],
  );

  const openAction = (refund, action) => {
    setActionTarget({ refund, action });
    setNote('');
  };

  const closeAction = () => {
    if (updatingId) return;
    setActionTarget(null);
    setNote('');
  };

  const confirmAction = async () => {
    if (!actionTarget?.refund) return;
    const { refund, action } = actionTarget;
    try {
      const payload =
        action === 'processed'
          ? { status: 'processed', razorpayRefundId: note.trim() || undefined }
          : { status: 'failed', error: note.trim() || 'Refund failed' };
      await updateRefundStatus(refund._id, payload);
      toast.success(
        action === 'processed'
          ? 'Refund marked as processed'
          : 'Refund marked as failed',
      );
      setActionTarget(null);
      setNote('');
    } catch (err) {
      toast.error(
        err?.response?.data?.message || err?.message || 'Could not update refund',
      );
    }
  };

  return (
    <div className="space-y-5 animate-fade-in-up">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-text">Refunds</h2>
          <p className="text-xs text-text-muted mt-1 max-w-xl">
            Refunds are processed manually on the{' '}
            <a
              href="https://dashboard.razorpay.com/app/refunds"
              target="_blank"
              rel="noreferrer"
              className="text-primary inline-flex items-center gap-0.5 hover:underline"
            >
              Razorpay dashboard
              <ExternalLink className="w-3 h-3" />
            </a>
            . Use this page to mark each request as <strong>processed</strong>{' '}
            (capture the gateway refund id) or <strong>failed</strong> (with a
            short note).
          </p>
        </div>
        <button
          type="button"
          onClick={() => fetchRefunds()}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-border-light text-sm font-medium hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-white border border-border-light rounded-2xl p-4"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs text-text-muted">{card.label}</p>
                <Icon className={`w-4 h-4 ${card.accent}`} />
              </div>
              <p className={`mt-2 text-lg font-bold ${card.accent}`}>
                {card.value}
              </p>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={filters.search}
            onChange={(e) => setFilter('search', e.target.value)}
            placeholder="Search by booking number"
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-border-light text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <select
          value={filters.status}
          onChange={(e) => setFilter('status', e.target.value)}
          className="px-3 py-2 rounded-xl border border-border-light text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="processed">Processed</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      <div className="bg-white border border-border-light rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-text-muted">
              <tr>
                <Th>Booking</Th>
                <Th>Customer</Th>
                <Th>Refund</Th>
                <Th>Cancellation fee</Th>
                <Th>Status</Th>
                <Th>Razorpay refund id</Th>
                <Th>Requested</Th>
                <Th>Reason</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={9} className="py-12">
                    <div className="flex items-center justify-center text-text-muted">
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Loading refunds…
                    </div>
                  </td>
                </tr>
              )}
              {!loading && refunds.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-text-muted">
                    No refunds to display.
                  </td>
                </tr>
              )}
              {!loading &&
                refunds.map((refund) => (
                  <RefundRow
                    key={refund._id}
                    refund={refund}
                    updating={updatingId === refund._id}
                    onMarkProcessed={() => openAction(refund, 'processed')}
                    onMarkFailed={() => openAction(refund, 'failed')}
                  />
                ))}
            </tbody>
          </table>
        </div>

        {!loading && refunds.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border-light">
            <p className="text-xs text-text-muted">
              Showing {(page - 1) * limit + 1}–
              {Math.min(page * limit, total)} of {total}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded-lg border border-border-light text-xs font-medium disabled:opacity-40"
              >
                Prev
              </button>
              <span className="text-xs text-text-muted">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 rounded-lg border border-border-light text-xs font-medium disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs text-danger">
          Could not load refunds: {error}
        </p>
      )}

      <ConfirmDialog
        open={!!actionTarget}
        onClose={closeAction}
        onConfirm={confirmAction}
        title={
          actionTarget?.action === 'processed'
            ? 'Mark refund as processed'
            : 'Mark refund as failed'
        }
        description={
          actionTarget?.action === 'processed'
            ? `Confirms you've already refunded ${formatCurrency(
                actionTarget?.refund?.amountRupees,
              )} on Razorpay. The booking's payment status will flip to "refunded".`
            : `Marks this refund as failed. The booking's payment status stays "paid" so you can record a new attempt later.`
        }
        confirmLabel={
          actionTarget?.action === 'processed' ? 'Mark processed' : 'Mark failed'
        }
        cancelLabel="Cancel"
        variant={actionTarget?.action === 'processed' ? 'success' : 'danger'}
        loading={!!updatingId}
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium text-text-muted uppercase tracking-wide">
            {actionTarget?.action === 'processed'
              ? 'Razorpay refund id (optional)'
              : 'Failure note (visible to admins)'}
          </span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              actionTarget?.action === 'processed'
                ? 'rfnd_XXXXXXXXXXXX'
                : 'e.g. customer closed account'
            }
            className="px-3 py-2 rounded-xl border border-border-light text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
      </ConfirmDialog>
    </div>
  );
};

function Th({ children }) {
  return (
    <th className="text-left text-[11px] font-semibold uppercase tracking-wide px-4 py-3">
      {children}
    </th>
  );
}

function RefundRow({ refund, updating, onMarkProcessed, onMarkFailed }) {
  const status = refund.status || 'pending';
  const meta = STATUS_META[status] || STATUS_META.pending;
  const Icon = meta.icon;
  const customer =
    refund.userId?.name || refund.userId?.phone || 'Customer';
  return (
    <tr className="border-t border-border-light hover:bg-gray-50/60 align-top">
      <td className="px-4 py-3">
        <p className="font-mono text-xs font-medium text-text">
          {refund.bookingNumber || '—'}
        </p>
        <p className="text-[10px] text-text-muted mt-0.5 font-mono">
          {String(refund.bookingId).slice(-8)}
        </p>
      </td>
      <td className="px-4 py-3 text-text">{customer}</td>
      <td className="px-4 py-3">
        <p className="font-semibold text-success">
          {formatCurrency(refund.amountRupees)}
        </p>
        <p className="text-[10px] text-text-muted mt-0.5">
          Paid: {formatCurrency(refund.grossPaidRupees)}
        </p>
      </td>
      <td className="px-4 py-3 text-xs text-text-muted">
        {Number(refund.cancellationFeeRupees) > 0
          ? formatCurrency(refund.cancellationFeeRupees)
          : '—'}
      </td>
      <td className="px-4 py-3">
        <Badge variant={meta.variant}>
          <span className="inline-flex items-center gap-1">
            <Icon className="w-3 h-3" />
            {meta.label}
          </span>
        </Badge>
        {refund.error && (
          <p className="text-[10px] text-danger mt-1 max-w-[12rem] truncate">
            {refund.error}
          </p>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-text-muted font-mono">
        {refund.razorpayRefundId || '—'}
      </td>
      <td className="px-4 py-3 text-xs text-text-muted">
        {formatDateTime(refund.createdAt)}
      </td>
      <td className="px-4 py-3 text-xs text-text-secondary capitalize">
        {(refund.reason || '').replaceAll('_', ' ') || '—'}
        <p className="text-[10px] text-text-muted mt-0.5">
          by {refund.initiatedBy}
        </p>
      </td>
      <td className="px-4 py-3">
        {status === 'pending' ? (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onMarkProcessed}
              disabled={updating}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold disabled:opacity-50"
            >
              {updating ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3 h-3" />
              )}
              Mark processed
            </button>
            <button
              type="button"
              onClick={onMarkFailed}
              disabled={updating}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold disabled:opacity-50"
            >
              <XCircle className="w-3 h-3" />
              Mark failed
            </button>
          </div>
        ) : (
          <span className="text-xs text-text-muted">—</span>
        )}
      </td>
    </tr>
  );
}

export default ManageRefunds;
