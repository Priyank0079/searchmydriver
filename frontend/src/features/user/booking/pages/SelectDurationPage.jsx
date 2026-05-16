import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../../../components/Card';
import Button from '../../../../components/Button';
import { ArrowLeft, Clock, Check } from 'lucide-react';

const durations = [
  { id: '1h', label: '1 Hour', price: 199, distanceNote: 'Upto 15 km' },
  { id: '2h', label: '2 Hours', price: 349, distanceNote: 'Upto 30 km', popular: true },
  { id: '3h', label: '3 Hours', price: 499, distanceNote: 'Upto 45 km' },
  { id: '4h', label: '4 Hours', price: 649, distanceNote: 'Upto 60 km' },
  { id: 'custom', label: 'Custom', price: null, distanceNote: 'Choose your own' },
];

const SelectDurationPage = () => {
  const navigate = useNavigate();
  const [selected, setSelected] = useState('2h');
  const [customHours, setCustomHours] = useState('');

  const selectedDuration = durations.find((d) => d.id === selected);
  const price = selected === 'custom' ? (Number(customHours) || 0) * 150 : selectedDuration?.price || 0;

  return (
    <div className="flex-1 flex flex-col bg-bg min-h-dvh">
      {/* Header */}
      <div className="bg-white px-4 pt-4 pb-4 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl hover:bg-gray-100">
            <ArrowLeft className="w-5 h-5 text-text" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-text">Select Duration</h1>
            <p className="text-xs text-text-muted">Auto calculated based on distance</p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-3">
        {durations.map((duration, idx) => {
          const isSelected = selected === duration.id;

          return (
            <Card
              key={duration.id}
              onClick={() => setSelected(duration.id)}
              hoverable
              className={`animate-fade-in-up transition-all ${isSelected ? 'ring-2 ring-primary' : ''}`}
              style={{ animationDelay: `${idx * 0.06}s` }}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isSelected ? 'bg-primary/15' : 'bg-gray-100'}`}>
                  <Clock className={`w-5 h-5 ${isSelected ? 'text-primary' : 'text-text-muted'}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm text-text">{duration.label}</h3>
                    {duration.popular && (
                      <span className="px-2 py-0.5 bg-primary/15 text-primary-dark text-[10px] font-bold rounded-full">POPULAR</span>
                    )}
                  </div>
                  <p className="text-xs text-text-muted mt-0.5">{duration.distanceNote}</p>
                </div>
                {duration.price ? (
                  <span className="text-sm font-bold text-text">₹{duration.price}</span>
                ) : (
                  <span className="text-xs text-text-muted">₹150/hr</span>
                )}
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${isSelected ? 'border-primary bg-primary' : 'border-gray-300'}`}>
                  {isSelected && <Check className="w-3 h-3 text-white" />}
                </div>
              </div>

              {/* Custom hours input */}
              {duration.id === 'custom' && isSelected && (
                <div className="mt-3 pt-3 border-t border-border-light">
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="1"
                      max="24"
                      placeholder="Hours"
                      value={customHours}
                      onChange={(e) => setCustomHours(e.target.value)}
                      className="w-24 h-10 bg-gray-50 border border-border rounded-xl px-3 text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <span className="text-sm text-text-secondary">hours × ₹150 = <strong>₹{price}</strong></span>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <div className="p-4 bg-white border-t border-border-light">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-text-secondary">Estimated fare</span>
          <span className="text-lg font-bold text-text">₹{price}</span>
        </div>
        <Button fullWidth onClick={() => navigate('/user/book/review')}>
          Continue
        </Button>
      </div>
    </div>
  );
};

export default SelectDurationPage;
