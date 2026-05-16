import { useNavigate } from 'react-router-dom';
import Card from '../../../../components/Card';
import Button from '../../../../components/Button';
import { ArrowLeft, Download, FileText } from 'lucide-react';

const InvoicePage = () => {
  const navigate = useNavigate();
  const invoice = {
    id: 'INV-3578',
    date: '16 May 2026, 10:10 AM',
    service: 'Point to Point',
    distance: '12.4 km',
    duration: '28 min',
    total: 449,
  };

  return (
    <div className="flex-1 flex flex-col bg-bg min-h-dvh">
      <div className="bg-white px-4 pt-4 pb-4 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl hover:bg-gray-100">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold">Invoice</h1>
        </div>
      </div>

      <div className="flex-1 p-4">
        <Card className="animate-fade-in-up">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              <span className="font-bold text-text">{invoice.id}</span>
            </div>
            <span className="text-xs text-text-muted">{invoice.date}</span>
          </div>

          <div className="space-y-3 mb-6">
            {[
              ['Service', invoice.service],
              ['Distance', invoice.distance],
              ['Duration', invoice.duration],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between">
                <span className="text-sm text-text-secondary">{label}</span>
                <span className="text-sm font-medium text-text">{value}</span>
              </div>
            ))}
            <div className="h-px bg-border-light" />
            <div className="flex justify-between">
              <span className="text-sm font-bold text-text">Total</span>
              <span className="text-lg font-bold text-text">₹{invoice.total}</span>
            </div>
          </div>

          <Button fullWidth variant="secondary" icon={Download}>
            Download Invoice
          </Button>
        </Card>
      </div>

      <div className="p-4">
        <Button fullWidth onClick={() => navigate('/user/home')}>Done</Button>
      </div>
    </div>
  );
};

export default InvoicePage;
