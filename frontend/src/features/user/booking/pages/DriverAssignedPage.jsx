import { useNavigate } from 'react-router-dom';
import Card from '../../../../components/Card';
import Button from '../../../../components/Button';
import Avatar from '../../../../components/Avatar';
import DummyMap from '../../../../components/DummyMap';
import { Star, Phone, MessageSquare } from 'lucide-react';

const DriverAssignedPage = () => {
  const navigate = useNavigate();
  const driver = { name: 'Ravi Kumar', rating: 4.8, trips: 1251, distance: '1.5 km', eta: '4 min', phone: '+91 98765 43210' };

  return (
    <div className="flex-1 flex flex-col bg-bg min-h-dvh">
      {/* Map */}
      <DummyMap className="h-64" showDriverPins showRoute label="Driver is 1.5 km away" />

      <div className="flex-1 -mt-6 relative z-10">
        <Card className="mx-4 animate-fade-in-up">
          <div className="text-center mb-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-success-light text-success text-sm font-semibold rounded-full">
              ✓ Driver Assigned!
            </span>
          </div>
          <div className="flex items-center gap-4 mb-4">
            <Avatar name={driver.name} size="xl" online />
            <div className="flex-1">
              <h3 className="text-lg font-bold text-text">{driver.name}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <Star className="w-4 h-4 text-primary fill-primary" />
                <span className="text-sm font-medium">{driver.rating}</span>
                <span className="text-text-muted text-xs">· {driver.trips} trips</span>
              </div>
              <p className="text-sm text-success font-medium mt-1">{driver.distance} away · ETA {driver.eta}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" size="md" className="flex-1" icon={Phone}>Call</Button>
            <Button variant="secondary" size="md" className="flex-1" icon={MessageSquare}>Message</Button>
          </div>
        </Card>

        <div className="px-4 mt-4">
          <Button fullWidth onClick={() => navigate('/user/tracking/on-way')}>View on Map</Button>
        </div>
      </div>
    </div>
  );
};

export default DriverAssignedPage;
