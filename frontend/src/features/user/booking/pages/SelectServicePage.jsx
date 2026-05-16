import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../../../components/Card';
import Button from '../../../../components/Button';
import Input from '../../../../components/Input';
import { ArrowLeft, MapPin, Clock, Sun, Navigation, ChevronRight, Calendar } from 'lucide-react';
import { SERVICE_TYPES } from '../../../../utils/constants';

const SelectServicePage = () => {
  const navigate = useNavigate();
  const [selected, setSelected] = useState(null);
  const [tripDetails, setTripDetails] = useState({
    pickup: 'Indore, MP',
    drop: '',
    date: '',
    time: '',
  });

  const iconMap = { MapPin, Clock, Sun, Navigation };

  return (
    <div className="flex-1 flex flex-col bg-bg min-h-dvh">
      {/* Header */}
      <div className="bg-white px-4 pt-4 pb-4 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl hover:bg-gray-100">
            <ArrowLeft className="w-5 h-5 text-text" />
          </button>
          <h1 className="text-lg font-bold text-text">Choose a service</h1>
        </div>
        <p className="text-xs text-text-muted mt-1 ml-10">that suits you</p>
      </div>

      <div className="flex-1 p-4 space-y-3">
        {SERVICE_TYPES.map((service, idx) => {
          const Icon = iconMap[service.icon] || MapPin;
          const isSelected = selected === service.id;

          return (
            <Card
              key={service.id}
              onClick={() => setSelected(service.id)}
              hoverable
              className={`animate-fade-in-up transition-all ${isSelected ? 'ring-2 ring-primary' : ''}`}
              style={{ animationDelay: `${idx * 0.06}s` }}
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${service.color}15` }}>
                  <Icon className="w-5 h-5" style={{ color: service.color }} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-sm text-text">{service.title}</h3>
                  <p className="text-xs text-text-muted">{service.description}</p>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'border-primary bg-primary' : 'border-gray-300'}`}>
                  {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                </div>
              </div>
            </Card>
          );
        })}

        {/* Trip Details */}
        {selected && (
          <Card className="animate-fade-in-up mt-4">
            <h3 className="text-sm font-semibold text-text mb-3">Enter Trip Details</h3>
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
        )}
      </div>

      {selected && (
        <div className="p-4 bg-white border-t border-border-light">
          <Button fullWidth onClick={() => navigate('/user/book/duration')}>
            Continue
          </Button>
        </div>
      )}
    </div>
  );
};

export default SelectServicePage;
