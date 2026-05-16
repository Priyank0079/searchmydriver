import { useNavigate } from 'react-router-dom';
import Card from '../../../../components/Card';
import Button from '../../../../components/Button';
import { CheckCircle, Clock, MapPin } from 'lucide-react';

const TripCompletedPage = () => {
  const navigate = useNavigate();

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-white min-h-dvh px-6">
      <div className="animate-bounce-in mb-6">
        <div className="w-20 h-20 bg-success-light rounded-full flex items-center justify-center">
          <CheckCircle className="w-10 h-10 text-success" />
        </div>
      </div>
      <h1 className="text-2xl font-bold text-text mb-1 animate-fade-in-up">Trip Completed</h1>
      <p className="text-sm text-text-muted mb-6 animate-fade-in-up">Thank you for riding with us!</p>

      <Card className="w-full animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
        <div className="text-center mb-4">
          <p className="text-sm text-text-muted">Total Fare</p>
          <p className="text-3xl font-bold text-text">₹449</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center p-3 bg-bg rounded-xl">
            <Clock className="w-5 h-5 text-text-muted mx-auto mb-1" />
            <p className="text-sm font-bold">25 min</p>
            <p className="text-[10px] text-text-muted">Duration</p>
          </div>
          <div className="text-center p-3 bg-bg rounded-xl">
            <MapPin className="w-5 h-5 text-text-muted mx-auto mb-1" />
            <p className="text-sm font-bold">12.4 km</p>
            <p className="text-[10px] text-text-muted">Distance</p>
          </div>
        </div>
      </Card>

      <div className="w-full mt-6 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
        <Button fullWidth onClick={() => navigate('/user/tracking/rate')}>Rate & Pay</Button>
      </div>
    </div>
  );
};

export default TripCompletedPage;
