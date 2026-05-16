import { useNavigate } from 'react-router-dom';
import Card from '../../../../components/Card';
import Button from '../../../../components/Button';
import Badge from '../../../../components/Badge';
import { CheckCircle } from 'lucide-react';

const PaymentStatusPage = () => {
  const navigate = useNavigate();

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-white min-h-dvh px-6">
      <Card className="w-full text-center animate-bounce-in">
        <div className="mb-4">
          <Badge variant="success" className="text-sm !px-4 !py-1.5">Paid Online</Badge>
        </div>
        <p className="text-4xl font-bold text-text mb-2">₹320</p>
        <div className="flex items-center justify-center gap-2 text-success">
          <CheckCircle className="w-5 h-5" />
          <p className="text-sm font-medium">Payment received successfully</p>
        </div>
      </Card>
      <div className="w-full mt-6">
        <Button fullWidth onClick={() => navigate('/driver/trip/rate')}>Continue</Button>
      </div>
    </div>
  );
};

export default PaymentStatusPage;
