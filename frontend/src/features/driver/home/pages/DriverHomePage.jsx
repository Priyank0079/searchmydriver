import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../../../components/Card';
import Toggle from '../../../../components/Toggle';
import { Star, TrendingUp, Bell, MapPin } from 'lucide-react';

const DriverHomePage = () => {
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(true);

  return (
    <div className="flex-1 flex flex-col bg-bg">
      {/* Header */}
      <div className="bg-dark px-4 pt-4 pb-6 rounded-b-3xl">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-bold text-white">Home</h1>
          <button className="relative p-2.5 rounded-xl bg-white/10">
            <Bell className="w-5 h-5 text-white" />
          </button>
        </div>
        {/* Online Toggle */}
        <Card className="!bg-white/10 backdrop-blur-sm !shadow-none">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-success animate-pulse' : 'bg-gray-400'}`} />
              <span className="text-white text-sm font-medium">
                {isOnline ? 'You are Online' : 'You are Offline'}
              </span>
            </div>
            <Toggle checked={isOnline} onChange={setIsOnline} />
          </div>
        </Card>
      </div>

      <div className="flex-1 p-4 -mt-3 space-y-4">
        {/* Earnings Card */}
        <Card className="animate-fade-in-up">
          <p className="text-xs text-text-muted mb-1">Today's Earnings</p>
          <p className="text-3xl font-bold text-text">₹850.00</p>
          <div className="flex items-center gap-6 mt-3">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-success" />
              <span className="text-sm"><strong>3</strong> <span className="text-text-muted">Trips</span></span>
            </div>
            <div className="flex items-center gap-1.5">
              <Star className="w-4 h-4 text-primary fill-primary" />
              <span className="text-sm"><strong>5.0</strong> <span className="text-text-muted">Rating</span></span>
            </div>
          </div>
        </Card>

        {/* Status */}
        {isOnline ? (
          <Card className="animate-fade-in-up border-l-4 border-l-success" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-success-light rounded-full flex items-center justify-center">
                <MapPin className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-sm font-medium text-text">You are online and ready to receive trips</p>
                <p className="text-xs text-text-muted mt-0.5">Incoming booking requests will appear here</p>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="animate-fade-in-up border-l-4 border-l-gray-300" style={{ animationDelay: '0.1s' }}>
            <p className="text-sm text-text-secondary text-center py-4">
              Go online to start receiving booking requests
            </p>
          </Card>
        )}

        {/* Demo: New Booking Button */}
        {isOnline && (
          <button onClick={() => navigate('/driver/trip/new-request')}
            className="w-full p-4 bg-primary/10 border-2 border-dashed border-primary rounded-2xl text-center animate-fade-in-up"
            style={{ animationDelay: '0.2s' }}>
            <p className="text-sm font-semibold text-primary">📱 Simulate New Booking Request</p>
            <p className="text-xs text-text-muted mt-1">Tap to see booking request screen</p>
          </button>
        )}
      </div>
    </div>
  );
};

export default DriverHomePage;
