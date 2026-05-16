import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../../../components/Card';
import Button from '../../../../components/Button';
import { MapPin, Clock, Navigation, IndianRupee } from 'lucide-react';

const NewBookingRequestPage = () => {
  const navigate = useNavigate();
  const [timer, setTimer] = useState(12);

  useEffect(() => {
    if (timer <= 0) { navigate('/driver/home'); return; }
    const t = setTimeout(() => setTimer(timer - 1), 1000);
    return () => clearTimeout(t);
  }, [timer, navigate]);

  return (
    <div className="flex-1 flex flex-col bg-black/60 min-h-dvh items-center justify-end">
      <Card className="w-full rounded-t-3xl rounded-b-none animate-slide-up !p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">New Booking Request</h2>
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
            <span className="text-sm font-bold text-dark">{timer}s</span>
          </div>
        </div>

        <div className="space-y-3 mb-4">
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 bg-success rounded-full mt-1.5 shrink-0" />
            <div>
              <p className="text-xs text-text-muted">Pickup</p>
              <p className="text-sm font-medium">Vijay Nagar, Indore</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 bg-danger rounded-full mt-1.5 shrink-0" />
            <div>
              <p className="text-xs text-text-muted">Drop</p>
              <p className="text-sm font-medium">Palasia, Indore</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-bg rounded-xl p-3 text-center">
            <Clock className="w-4 h-4 text-text-muted mx-auto mb-1" />
            <p className="text-xs font-bold">2 Hrs</p>
            <p className="text-[10px] text-text-muted">Duration</p>
          </div>
          <div className="bg-bg rounded-xl p-3 text-center">
            <Navigation className="w-4 h-4 text-text-muted mx-auto mb-1" />
            <p className="text-xs font-bold">1.5 km</p>
            <p className="text-[10px] text-text-muted">Distance</p>
          </div>
          <div className="bg-bg rounded-xl p-3 text-center">
            <IndianRupee className="w-4 h-4 text-text-muted mx-auto mb-1" />
            <p className="text-xs font-bold">₹250</p>
            <p className="text-[10px] text-text-muted">Fare</p>
          </div>
        </div>

        <p className="text-[10px] text-text-muted text-center mb-4">Auto reject in {timer} seconds</p>

        <div className="flex gap-3">
          <Button variant="danger" size="lg" className="flex-1" onClick={() => navigate('/driver/home')}>
            Reject
          </Button>
          <Button variant="success" size="lg" className="flex-1" onClick={() => navigate('/driver/trip/navigate')}>
            Accept
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default NewBookingRequestPage;
