import { useNavigate } from 'react-router-dom';
import Card from '../../../../components/Card';
import Button from '../../../../components/Button';
import Avatar from '../../../../components/Avatar';
import DummyMap from '../../../../components/DummyMap';
import { CheckCircle, Car } from 'lucide-react';

const ArrivedStartTripPage = () => {
  const navigate = useNavigate();

  return (
    <div className="flex-1 flex flex-col bg-bg min-h-dvh">
      <DummyMap className="h-48" showDriverPins label="You have arrived">
        {/* Overlay banner */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-success/90 backdrop-blur-sm px-5 py-2.5 rounded-2xl shadow-md animate-bounce-in">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-white" />
            <span className="text-white font-medium text-sm">You have arrived at pickup location</span>
          </div>
        </div>
      </DummyMap>
      <div className="flex-1 p-4 -mt-4 z-10 space-y-4">
        <Card className="animate-fade-in-up">
          <div className="flex items-center gap-3 mb-3">
            <Avatar name="Abhishek Sharma" size="lg" />
            <div className="flex-1">
              <h3 className="font-bold">Abhishek Sharma</h3>
              <p className="text-xs text-text-muted">MP09 AB 1234</p>
            </div>
          </div>
          <div className="p-3 bg-bg rounded-xl mb-3">
            <div className="flex items-center gap-2">
              <Car className="w-4 h-4 text-text-muted" />
              <div>
                <p className="text-xs text-text-muted">Driving customer's car</p>
                <p className="text-sm font-medium">Please drive safely</p>
              </div>
            </div>
          </div>
          <p className="text-xs text-text-muted text-center">Verify and start the trip</p>
        </Card>
        <Button fullWidth variant="success" onClick={() => navigate('/driver/trip/in-progress')}>
          START TRIP
        </Button>
      </div>
    </div>
  );
};

export default ArrivedStartTripPage;
