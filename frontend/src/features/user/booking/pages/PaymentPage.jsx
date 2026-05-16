import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../../../components/Card';
import Button from '../../../../components/Button';
import { ArrowLeft, Smartphone, CreditCard, Wallet, Banknote, Shield, Check } from 'lucide-react';

const methods = [
  { id: 'upi', label: 'UPI', sub: 'Google Pay, PhonePe', icon: Smartphone, color: '#9B59B6' },
  { id: 'card', label: 'Card', sub: 'Visa, MasterCard', icon: CreditCard, color: '#3498DB' },
  { id: 'wallet', label: 'Wallet', sub: 'Paytm, Amazon Pay', icon: Wallet, color: '#2ECC71' },
  { id: 'sd', label: 'SpareDriver Wallet', sub: '₹1,250', icon: Banknote, color: '#F39C12' },
];

const PaymentPage = () => {
  const navigate = useNavigate();
  const [sel, setSel] = useState('upi');
  const [loading, setLoading] = useState(false);

  const handlePay = () => {
    setLoading(true);
    setTimeout(() => { setLoading(false); navigate('/user/book/searching'); }, 2000);
  };

  return (
    <div className="flex-1 flex flex-col bg-bg min-h-dvh">
      <div className="bg-white px-4 pt-4 pb-4 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl hover:bg-gray-100">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold">Payment Options</h1>
        </div>
      </div>
      <div className="flex-1 p-4 space-y-3">
        {methods.map((m, i) => {
          const Icon = m.icon;
          const active = sel === m.id;
          return (
            <Card key={m.id} onClick={() => setSel(m.id)} hoverable
              className={`animate-fade-in-up ${active ? 'ring-2 ring-primary' : ''}`}
              style={{ animationDelay: `${i * 0.06}s` }}>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${m.color}15` }}>
                  <Icon className="w-5 h-5" style={{ color: m.color }} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-sm">{m.label}</h3>
                  <p className="text-xs text-text-muted">{m.sub}</p>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${active ? 'border-primary bg-primary' : 'border-gray-300'}`}>
                  {active && <Check className="w-3 h-3 text-white" />}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      <div className="p-4 bg-white border-t border-border-light space-y-3">
        <div className="flex items-center justify-center gap-2 text-xs text-text-muted">
          <Shield className="w-3.5 h-3.5 text-success" /> 100% Secure Payments
        </div>
        <Button fullWidth loading={loading} onClick={handlePay}>Pay ₹449</Button>
      </div>
    </div>
  );
};

export default PaymentPage;
