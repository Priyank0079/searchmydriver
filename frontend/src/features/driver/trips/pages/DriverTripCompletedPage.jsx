import { useNavigate } from 'react-router-dom';
import Card from '../../../../components/Card';
import Button from '../../../../components/Button';
import { CheckCircle, Clock, MapPin, Car } from 'lucide-react';

const DriverTripCompletedPage = () => {
  const navigate = useNavigate();

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-white min-h-dvh px-6">
      <div className="animate-bounce-in mb-5">
        <div className="w-20 h-20 bg-success-light rounded-full flex items-center justify-center">
          <CheckCircle className="w-10 h-10 text-success" />
        </div>
      </div>
      <p className="text-sm text-text-muted mb-1">Trip Completed</p>
      <div className="mb-2">
        <p className="text-xs text-text-muted">Total Earnings</p>
        <p className="text-3xl font-bold text-text text-center">₹320</p>
      </div>
      <p className="text-sm text-text-secondary mb-6 text-center">Thank you for completing the trip.</p>

      <Card className="w-full animate-fade-in-up mb-6">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <Clock className="w-5 h-5 text-text-muted mx-auto mb-1" />
            <p className="text-sm font-bold">02:10:15</p>
            <p className="text-[10px] text-text-muted">Duration</p>
          </div>
          <div>
            <MapPin className="w-5 h-5 text-text-muted mx-auto mb-1" />
            <p className="text-sm font-bold">10.6 km</p>
            <p className="text-[10px] text-text-muted">Distance</p>
          </div>
          <div>
            <Car className="w-5 h-5 text-text-muted mx-auto mb-1" />
            <p className="text-sm font-bold">Hourly</p>
            <p className="text-[10px] text-text-muted">Trip Type</p>
          </div>
        </div>
      </Card>

      <Button fullWidth onClick={() => navigate('/driver/trip/payment')}>COMPLETE</Button>
    </div>
  );
};

export default DriverTripCompletedPage;
