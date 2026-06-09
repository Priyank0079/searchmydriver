import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, ArrowDownLeft, ArrowUpRight, Loader2, RefreshCcw } from 'lucide-react';
import Card from '../../../../components/Card';
import Button from '../../../../components/Button';
import useUserWalletStore from '../../../../store/user/useUserWalletStore';
import TopupSheet from '../components/TopupSheet';

/**
 * Full-page wallet view: balance, lifetime totals, and the most recent
 * transaction ledger. The "+ Add money" CTA opens the shared
 * `TopupSheet`. After a successful top-up the page silently re-fetches
 * the transaction list so the new credit lands at the top.
 */
const PAGE_SIZE = 20;

const WalletPage = () => {
  const navigate = useNavigate();
  const wallet = useUserWalletStore((s) => s.wallet);
  const transactions = useUserWalletStore((s) => s.transactions);
  const loading = useUserWalletStore((s) => s.loading);
  const fetched = useUserWalletStore((s) => s.fetched);
  const page = useUserWalletStore((s) => s.page);
  const hasMore = useUserWalletStore((s) => s.hasMore);
  const fetchWallet = useUserWalletStore((s) => s.fetchWallet);
  const fetchTransactions = useUserWalletStore((s) => s.fetchTransactions);

  const [topupOpen, setTopupOpen] = useState(false);

  useEffect(() => {
    fetchWallet().catch(() => {});
    fetchTransactions({ page: 1, limit: PAGE_SIZE }).catch(() => {});
  }, [fetchWallet, fetchTransactions]);

  const onLoadMore = () => {
    if (loading || !hasMore) return;
    fetchTransactions({
      page: page + 1,
      limit: PAGE_SIZE,
      append: true,
    }).catch(() => {});
  };

  // Show the truly-spendable amount as the headline number. The raw
  // `balance` and the locked-against-bookings amount appear below it so
  // the user can see why they may have less to spend than they expect.
  const heldRupees = Number(wallet.heldRupees || 0);
  const balance = Number(wallet.balance || 0);
  const available =
    wallet.availableRupees != null
      ? Number(wallet.availableRupees)
      : Math.max(0, balance - heldRupees);
  const fmt = (n) =>
    `\u20B9${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  const balanceLabel = useMemo(() => fmt(available), [available]);

  return (
    <div className="flex-1 flex flex-col bg-bg min-h-dvh">
      <div className="bg-white px-4 pt-4 pb-4 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-xl hover:bg-gray-100"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5 text-text" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-text">My wallet</h1>
            <p className="text-xs text-text-muted">
              Pay for bookings instantly from your balance.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              fetchWallet().catch(() => {});
              fetchTransactions({ page: 1, limit: PAGE_SIZE }).catch(() => {});
            }}
            className="p-2 rounded-xl text-text-muted hover:bg-gray-100"
            aria-label="Refresh"
          >
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4 flex-1">
        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 text-white">
          <p className="text-[11px] uppercase tracking-wide text-white/70">
            Available balance
          </p>
          <p className="text-3xl font-bold mt-1">{balanceLabel}</p>
          {heldRupees > 0 && (
            <p className="text-[11px] text-emerald-200 mt-1">
              {fmt(heldRupees)} held against active bookings &middot; total balance {fmt(balance)}
            </p>
          )}
          <div className="mt-4 grid grid-cols-2 gap-3 text-[11px] text-white/80">
            <div>
              <p className="uppercase tracking-wide">Lifetime added</p>
              <p className="text-sm font-semibold text-white mt-0.5">
                ₹{Number(wallet.totalCredited || 0).toLocaleString('en-IN')}
              </p>
            </div>
            <div>
              <p className="uppercase tracking-wide">Lifetime spent</p>
              <p className="text-sm font-semibold text-white mt-0.5">
                ₹{Number(wallet.totalSpent || 0).toLocaleString('en-IN')}
              </p>
            </div>
          </div>
          <div className="mt-5">
            <Button
              fullWidth
              variant="primary"
              icon={Plus}
              onClick={() => setTopupOpen(true)}
            >
              Add money
            </Button>
          </div>
        </Card>

        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <h2 className="text-sm font-semibold text-text">Recent activity</h2>
            {loading && fetched && (
              <Loader2 className="w-4 h-4 animate-spin text-text-muted" />
            )}
          </div>

          {!fetched && loading ? (
            <Card>
              <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
              </div>
            </Card>
          ) : transactions.length === 0 ? (
            <Card>
              <div className="text-center py-6 text-sm text-text-muted">
                No transactions yet.
              </div>
            </Card>
          ) : (
            <>
              <Card padding="p-0" className="divide-y divide-border-light overflow-hidden">
                {transactions.map((tx) => (
                  <TransactionRow key={tx._id} tx={tx} />
                ))}
              </Card>
              {hasMore && (
                <Button
                  fullWidth
                  variant="ghost"
                  size="sm"
                  className="mt-3"
                  loading={loading}
                  onClick={onLoadMore}
                >
                  Load more
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      <TopupSheet
        open={topupOpen}
        onClose={() => setTopupOpen(false)}
        title="Add money to wallet"
        subtitle="Use UPI, cards, netbanking or wallets."
        onSuccess={() =>
          fetchTransactions({ page: 1, limit: PAGE_SIZE }).catch(() => {})
        }
      />
    </div>
  );
};

function TransactionRow({ tx }) {
  const isCredit = tx.direction === 'credit';
  const Icon = isCredit ? ArrowDownLeft : ArrowUpRight;
  const tone = isCredit ? 'text-success bg-success/10' : 'text-text bg-gray-100';
  return (
    <div className="flex items-center gap-3 px-3 py-3">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${tone}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text truncate">
          {tx.description || sourceLabel(tx.source)}
        </p>
        <p className="text-[11px] text-text-muted">
          {formatDate(tx.createdAt)} · {tx.status}
        </p>
      </div>
      <div className="text-right">
        <p className={`text-sm font-bold ${isCredit ? 'text-success' : 'text-text'}`}>
          {isCredit ? '+' : '-'}₹{Number(tx.amountRupees || 0).toLocaleString('en-IN')}
        </p>
        <p className="text-[10px] text-text-muted">
          bal ₹{Number(tx.balanceAfter || 0).toLocaleString('en-IN')}
        </p>
      </div>
    </div>
  );
}

function sourceLabel(source) {
  switch (source) {
    case 'topup':
      return 'Wallet top-up';
    case 'admin_credit':
      return 'Credit from support';
    case 'admin_debit':
      return 'Adjustment by support';
    case 'booking_payment':
      return 'Booking payment';
    case 'booking_refund':
      return 'Booking refund';
    case 'booking_no_drivers_refund':
      return 'Refund (no drivers)';
    default:
      return source || 'Transaction';
  }
}

function formatDate(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export default WalletPage;
