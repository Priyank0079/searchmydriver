import { useNavigate } from 'react-router-dom';
import Card from '../../../../components/Card';
import Button from '../../../../components/Button';
import Avatar from '../../../../components/Avatar';
import DummyMap from '../../../../components/DummyMap';
import { Star, Phone, MessageSquare, CheckCircle } from 'lucide-react';

const DriverReachedPage = () => {
  const navigate = useNavigate();
  const driver = { name: 'Ravi Kumar', rating: 4.8, car: 'MP09 AB 1234' };

  return (
    <div className="flex-1 flex flex-col bg-bg min-h-dvh">
      <DummyMap className="h-64" showDriverPins label="Driver has arrived">
        {/* Overlay badge */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-success/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-md animate-bounce-in">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-white" />
            <span className="text-white font-medium text-sm">Has reached your location</span>
          </div>
        </div>
      </DummyMap>
      <div className="flex-1 -mt-6 z-10">
        <Card className="mx-4">
          <div className="flex items-center gap-3 mb-4">
            <Avatar name={driver.name} size="lg" online />
            <div className="flex-1">
              <h3 className="font-bold text-text">{driver.name}</h3>
              <div className="flex items-center gap-1 mt-0.5">
                <Star className="w-3.5 h-3.5 text-primary fill-primary" />
                <span className="text-sm">{driver.rating}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-3 mb-4">
            <Button variant="secondary" size="md" className="flex-1" icon={Phone}>Call</Button>
            <Button variant="secondary" size="md" className="flex-1" icon={MessageSquare}>Message</Button>
          </div>
        </Card>
        <div className="px-4 mt-4">
          <Button fullWidth variant="success" onClick={() => navigate('/user/tracking/in-progress')}>
            Start Trip
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DriverReachedPage;
