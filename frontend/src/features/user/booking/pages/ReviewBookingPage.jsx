import { useNavigate } from 'react-router-dom';
import Card from '../../../../components/Card';
import Button from '../../../../components/Button';
import { ArrowLeft, MapPin, Clock, Car, Calendar, CircleDot, Check } from 'lucide-react';

const ReviewBookingPage = () => {
  const navigate = useNavigate();

  const bookingDetails = {
    service: 'Hourly Booking',
    pickup: 'Vijay Nagar, Indore, MP',
    drop: 'Palasia, Indore',
    date: '16 May 2026, 10:30 AM',
    duration: '2 Hours',
    distance: '~4.8 km',
    estimatedTime: '28 min',
  };

  const fareBreakdown = [
    { label: 'Base Fare', amount: 349 },
    { label: 'Service Fee', amount: 50 },
    { label: 'Fuel Charges', amount: 30 },
    { label: 'Refundable Fee', amount: 20 },
  ];

  const total = fareBreakdown.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="flex-1 flex flex-col bg-bg min-h-dvh">
      {/* Header */}
      <div className="bg-white px-4 pt-4 pb-4 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl hover:bg-gray-100">
            <ArrowLeft className="w-5 h-5 text-text" />
          </button>
          <h1 className="text-lg font-bold text-text">Review Your Booking</h1>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-4">
        {/* Trip Info */}
        <Card className="animate-fade-in-up">
          <div className="space-y-4">
            {/* Route */}
            <div className="flex gap-3">
              <div className="flex flex-col items-center gap-1 pt-1">
                <CircleDot className="w-4 h-4 text-success" />
                <div className="w-0.5 h-8 bg-gray-200" />
                <MapPin className="w-4 h-4 text-danger" />
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <p className="text-xs text-text-muted">Pickup</p>
                  <p className="text-sm font-medium text-text">{bookingDetails.pickup}</p>
                </div>
                <div>
                  <p className="text-xs text-text-muted">Drop</p>
                  <p className="text-sm font-medium text-text">{bookingDetails.drop}</p>
                </div>
              </div>
            </div>

            <div className="h-px bg-border-light" />

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-text-muted" />
                <div>
                  <p className="text-[10px] text-text-muted">Date & Time</p>
                  <p className="text-xs font-medium text-text">{bookingDetails.date}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-text-muted" />
                <div>
                  <p className="text-[10px] text-text-muted">Duration</p>
                  <p className="text-xs font-medium text-text">{bookingDetails.duration}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Car className="w-4 h-4 text-text-muted" />
                <div>
                  <p className="text-[10px] text-text-muted">Service</p>
                  <p className="text-xs font-medium text-text">{bookingDetails.service}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-text-muted" />
                <div>
                  <p className="text-[10px] text-text-muted">Distance</p>
                  <p className="text-xs font-medium text-text">{bookingDetails.distance}</p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Fare Breakdown */}
        <Card className="animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <h3 className="text-sm font-semibold text-text mb-3">Fare Details</h3>
          <div className="space-y-2.5">
            {fareBreakdown.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">{item.label}</span>
                <span className="text-sm text-text">₹{item.amount}</span>
              </div>
            ))}
            <div className="h-px bg-border-light my-1" />
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-text">Total</span>
              <span className="text-lg font-bold text-text">₹{total}</span>
            </div>
          </div>
        </Card>
      </div>

      <div className="p-4 bg-white border-t border-border-light">
        <Button fullWidth onClick={() => navigate('/user/book/payment')}>
          Confirm & Pay ₹{total}
        </Button>
      </div>
    </div>
  );
};

export default ReviewBookingPage;
