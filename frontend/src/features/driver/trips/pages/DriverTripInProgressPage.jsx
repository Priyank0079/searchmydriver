import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../../../components/Card';
import Button from '../../../../components/Button';
import { Clock, Phone, Navigation, Headphones } from 'lucide-react';

const DriverTripInProgressPage = () => {
  const navigate = useNavigate();
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const i = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(i);
  }, []);

  const fmt = (s) => {
    const h = String(Math.floor(s / 3600)).padStart(2, '0');
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const sec = String(s % 60).padStart(2, '0');
    return `${h}:${m}:${sec}`;
  };

  return (
    <div className="flex-1 flex flex-col bg-bg min-h-dvh">
      <div className="bg-dark px-4 pt-4 pb-6 rounded-b-3xl text-center">
        <p className="text-white/60 text-xs mb-1">Trip in Progress</p>
        <p className="text-4xl font-bold text-white font-mono tracking-wider">{fmt(seconds)}</p>
        <div className="mt-3 inline-flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full">
          <Clock className="w-3.5 h-3.5 text-primary" />
          <span className="text-white/80 text-xs">Hourly Booking · 2 Hours</span>
        </div>
      </div>
      <div className="flex-1 p-4 -mt-3 space-y-4">
        <Card className="animate-fade-in-up">
          <Button fullWidth variant="danger" onClick={() => navigate('/driver/trip/completed')}>
            END TRIP
          </Button>
        </Card>
        <div className="flex gap-3 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          {[
            { icon: Phone, label: 'Call' },
            { icon: Navigation, label: 'Navigation' },
            { icon: Headphones, label: 'Support' },
          ].map((action) => (
            <button key={action.label} className="flex-1 flex flex-col items-center gap-1.5 p-3 bg-white rounded-2xl shadow-card">
              <action.icon className="w-5 h-5 text-text-secondary" />
              <span className="text-[10px] text-text-muted">{action.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DriverTripInProgressPage;
