import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CreditCard, Wallet } from 'lucide-react';
import Card from '../../../../components/Card';

export default function PaymentMethodsPage() {
  const navigate = useNavigate();

  return (
    <div className="flex-1 flex flex-col bg-bg min-h-dvh">
      <Header title="Payment Methods" onBack={() => navigate('/user/account')} />
      <div className="flex-1 p-4 space-y-4">
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-text">No saved cards yet</h2>
              <p className="text-sm text-text-secondary">Payments are handled securely through Razorpay at checkout.</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-text">Wallet available</h2>
              <p className="text-sm text-text-secondary">Use your wallet balance from the Wallet screen for fast booking payments.</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Header({ title, onBack }) {
  return (
    <div className="bg-white px-4 pt-4 pb-4 shadow-sm">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onBack} className="p-2 -ml-2 rounded-xl hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5 text-text" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-text">{title}</h1>
          <p className="text-xs text-text-muted">Manage payment access</p>
        </div>
      </div>
    </div>
  );
}
