import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../../../components/Card';
import Button from '../../../../components/Button';
import DummyMap from '../../../../components/DummyMap';
import { Clock, MapPin, DollarSign } from 'lucide-react';

const TripInProgressPage = () => {
  const navigate = useNavigate();
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (s) => {
    const h = String(Math.floor(s / 3600)).padStart(2, '0');
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const sec = String(s % 60).padStart(2, '0');
    return `${h}:${m}:${sec}`;
  };

  const distance = (8.2 + seconds * 0.01).toFixed(1);
  const fare = Math.round(186 + seconds * 0.5);

  return (
    <div className="flex-1 flex flex-col bg-bg min-h-dvh">
      <DummyMap className="h-56" showRoute label="Trip in progress" />

      <div className="flex-1 -mt-8 z-10 px-4 space-y-4">
        <Card className="text-center animate-fade-in-up">
          <p className="text-sm text-text-muted mb-1">Trip in Progress</p>
          <p className="text-4xl font-bold text-text font-mono tracking-wider">{formatTime(seconds)}</p>
        </Card>

        <div className="grid grid-cols-3 gap-3 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <Card className="text-center !p-3">
            <MapPin className="w-5 h-5 text-info mx-auto mb-1" />
            <p className="text-lg font-bold">{distance}</p>
            <p className="text-[10px] text-text-muted">km</p>
          </Card>
          <Card className="text-center !p-3">
            <Clock className="w-5 h-5 text-warning mx-auto mb-1" />
            <p className="text-lg font-bold">{Math.floor(seconds / 60)}</p>
            <p className="text-[10px] text-text-muted">minutes</p>
          </Card>
          <Card className="text-center !p-3">
            <DollarSign className="w-5 h-5 text-success mx-auto mb-1" />
            <p className="text-lg font-bold">₹{fare}</p>
            <p className="text-[10px] text-text-muted">fare</p>
          </Card>
        </div>

        <Button fullWidth variant="danger" onClick={() => navigate('/user/tracking/completed')}>
          End Trip
        </Button>
      </div>
    </div>
  );
};

export default TripInProgressPage;
