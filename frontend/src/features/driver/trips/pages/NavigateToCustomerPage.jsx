import { useNavigate } from 'react-router-dom';
import Card from '../../../../components/Card';
import Button from '../../../../components/Button';
import Avatar from '../../../../components/Avatar';
import DummyMap from '../../../../components/DummyMap';
import { Phone, MessageSquare, Footprints, Bike, Car } from 'lucide-react';

const NavigateToCustomerPage = () => {
  const navigate = useNavigate();

  return (
    <div className="flex-1 flex flex-col bg-bg min-h-dvh">
      <div className="bg-white px-4 pt-4 pb-3 shadow-sm">
        <h1 className="text-lg font-bold">Navigate to Customer</h1>
      </div>

      {/* Map */}
      <DummyMap className="h-56" showDriverPins showRoute label="1.5 km · ETA 6 mins" />

      <div className="flex-1 p-4 -mt-4 z-10 space-y-4">
        {/* Customer Info */}
        <Card className="animate-fade-in-up">
          <div className="flex items-center gap-3 mb-3">
            <Avatar name="Abhishek Sharma" size="lg" />
            <div className="flex-1">
              <h3 className="font-bold text-text">Abhishek Sharma</h3>
              <p className="text-xs text-text-muted">MP09 AB 1234</p>
            </div>
          </div>
          <div className="flex gap-3 mb-4">
            <Button variant="secondary" size="md" className="flex-1" icon={Phone}>Call</Button>
            <Button variant="secondary" size="md" className="flex-1" icon={MessageSquare}>Message</Button>
          </div>
          {/* Travel Mode */}
          <div>
            <p className="text-xs text-text-muted mb-2">Travel Mode</p>
            <div className="flex gap-2">
              {[
                { icon: Footprints, label: 'Walk' },
                { icon: Bike, label: 'Bike' },
                { icon: Car, label: 'Car' },
              ].map((mode, i) => (
                <button key={mode.label} className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs transition-colors
                  ${i === 0 ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border text-text-muted'}`}>
                  <mode.icon className="w-4 h-4" />
                  {mode.label}
                </button>
              ))}
            </div>
          </div>
        </Card>

        <Button fullWidth variant="success" onClick={() => navigate('/driver/trip/arrived')}>
          Start Navigation
        </Button>
      </div>
    </div>
  );
};

export default NavigateToCustomerPage;
