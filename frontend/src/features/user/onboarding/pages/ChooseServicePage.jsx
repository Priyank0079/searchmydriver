import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../../../components/Button';
import Input from '../../../../components/Input';
import Card from '../../../../components/Card';
import { ArrowLeft, MapPin, Clock, Sun, Navigation, Calendar, ChevronRight } from 'lucide-react';
import { SERVICE_TYPES } from '../../../../utils/constants';

const iconMap = { MapPin, Clock, Sun, Navigation };

const ChooseServicePage = () => {
  const navigate = useNavigate();
  const [selected, setSelected] = useState(null);
  const [tripDetails, setTripDetails] = useState({
    pickup: '',
    drop: '',
    date: '',
    time: '',
  });

  return (
    <div className="flex-1 flex flex-col bg-bg min-h-dvh">
      {/* Header */}
      <div className="bg-white px-4 pt-4 pb-4 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl hover:bg-gray-100">
            <ArrowLeft className="w-5 h-5 text-text" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-text">Choose a Service</h1>
            <p className="text-xs text-text-muted">Select the type of service you need</p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-3">
        {/* Service Cards */}
        {SERVICE_TYPES.map((service, idx) => {
          const Icon = iconMap[service.icon] || MapPin;
          const isSelected = selected === service.id;

          return (
            <Card
              key={service.id}
              onClick={() => setSelected(service.id)}
              hoverable
              className={`animate-fade-in-up transition-all duration-200 ${isSelected ? 'ring-2 ring-primary shadow-md' : ''}`}
              style={{ animationDelay: `${idx * 0.08}s` }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${service.color}15` }}
                >
                  <Icon className="w-6 h-6" style={{ color: service.color }} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-text text-sm">{service.title}</h3>
                  <p className="text-xs text-text-muted mt-0.5">{service.description}</p>
                </div>
                <ChevronRight className={`w-5 h-5 transition-colors ${isSelected ? 'text-primary' : 'text-text-muted'}`} />
              </div>
            </Card>
          );
        })}

        {/* Trip Details (shown when service selected) */}
        {selected && (
          <div className="space-y-3 pt-3 animate-fade-in-up">
            <h3 className="text-sm font-semibold text-text px-1">Trip Details</h3>
            
            <Card>
              <div className="space-y-3">
                <Input
                  label="Pickup Location"
                  placeholder="Enter pickup location"
                  value={tripDetails.pickup}
                  onChange={(e) => setTripDetails((p) => ({ ...p, pickup: e.target.value }))}
                  icon={MapPin}
                />
                {selected === 'point-to-point' && (
                  <Input
                    label="Drop Location"
                    placeholder="Enter drop location"
                    value={tripDetails.drop}
                    onChange={(e) => setTripDetails((p) => ({ ...p, drop: e.target.value }))}
                    icon={MapPin}
                  />
                )}
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Date"
                    type="date"
                    value={tripDetails.date}
                    onChange={(e) => setTripDetails((p) => ({ ...p, date: e.target.value }))}
                    icon={Calendar}
                  />
                  <Input
                    label="Time"
                    type="time"
                    value={tripDetails.time}
                    onChange={(e) => setTripDetails((p) => ({ ...p, time: e.target.value }))}
                    icon={Clock}
                  />
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Continue */}
      {selected && (
        <div className="p-4 bg-white border-t border-border-light animate-slide-up">
          <Button fullWidth onClick={() => navigate('/user/home')}>
            Continue
          </Button>
        </div>
      )}
    </div>
  );
};

export default ChooseServicePage;
