import { useNavigate } from 'react-router-dom';
import Card from '../../../../components/Card';
import Button from '../../../../components/Button';
import Avatar from '../../../../components/Avatar';
import DummyMap from '../../../../components/DummyMap';
import { Star, Phone, MessageSquare } from 'lucide-react';

const DriverOnWayPage = () => {
  const navigate = useNavigate();
  const driver = { name: 'Ravi Kumar', rating: 4.8, eta: '4 min', vehicle: 'Coming by Bike' };

  return (
    <div className="flex-1 flex flex-col bg-bg min-h-dvh">
      <DummyMap className="h-72" showDriverPins showRoute label={`ETA ${driver.eta}`} />
      <div className="flex-1 -mt-6 z-10">
        <Card className="mx-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
            <span className="text-sm font-medium text-success">Driver on the way</span>
          </div>
          <div className="flex items-center gap-3 mb-4">
            <Avatar name={driver.name} size="lg" online />
            <div className="flex-1">
              <h3 className="font-bold text-text">{driver.name}</h3>
              <div className="flex items-center gap-1 mt-0.5">
                <Star className="w-3.5 h-3.5 text-primary fill-primary" />
                <span className="text-sm">{driver.rating}</span>
              </div>
              <p className="text-xs text-text-muted mt-0.5">{driver.vehicle}</p>
            </div>
            <span className="text-lg font-bold text-text">{driver.eta}</span>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" size="md" className="flex-1" icon={Phone}>Call</Button>
            <Button variant="secondary" size="md" className="flex-1" icon={MessageSquare}>Message</Button>
          </div>
        </Card>
        <div className="px-4 mt-4">
          <Button fullWidth variant="success" onClick={() => navigate('/user/tracking/reached')}>
            Driver Reached (Demo)
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DriverOnWayPage;
