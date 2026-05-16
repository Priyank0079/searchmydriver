import { useState } from 'react';
import Card from '../../../../components/Card';
import Badge from '../../../../components/Badge';
import { MapPin, Clock, Calendar } from 'lucide-react';
import { MOCK_BOOKINGS } from '../../../../utils/constants';

const tabs = ['Upcoming', 'Searching', 'Confirmed', 'Completed'];
const badgeMap = { upcoming: 'warning', searching: 'info', confirmed: 'primary', completed: 'success' };

const ActivityPage = () => {
  const [activeTab, setActiveTab] = useState('Completed');

  const filtered = MOCK_BOOKINGS.filter((b) => {
    if (activeTab === 'Completed') return b.status === 'completed';
    if (activeTab === 'Upcoming') return b.status === 'upcoming';
    return false;
  });

  return (
    <div className="flex-1 flex flex-col bg-bg">
      <div className="bg-white px-4 pt-4 pb-0 shadow-sm">
        <h1 className="text-lg font-bold text-text mb-3">My Bookings</h1>
        <div className="flex gap-1 overflow-x-auto pb-0 -mx-4 px-4">
          {tabs.map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors
                ${activeTab === tab ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-text-muted hover:text-text'}`}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 p-4 space-y-3">
        {filtered.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20">
            <Calendar className="w-12 h-12 text-text-muted mb-3" />
            <p className="text-sm text-text-muted">No {activeTab.toLowerCase()} bookings</p>
          </div>
        ) : (
          filtered.map((booking, idx) => (
            <Card key={booking.id} hoverable className="animate-fade-in-up" style={{ animationDelay: `${idx * 0.06}s` }}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-text-muted">{booking.id}</span>
                  <Badge variant={badgeMap[booking.status]}>{booking.status}</Badge>
                </div>
                <span className="text-sm font-bold text-text">₹{booking.fare}</span>
              </div>
              <h3 className="text-sm font-semibold text-text">{booking.serviceType}</h3>
              <div className="mt-2 space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-text-secondary">
                  <MapPin className="w-3.5 h-3.5 text-text-muted shrink-0" />
                  <span>{booking.pickup}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-text-muted">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>{booking.date} · {booking.duration}</span>
                </div>
              </div>
              {booking.driverName && (
                <div className="mt-3 pt-3 border-t border-border-light flex items-center justify-between">
                  <span className="text-xs text-text-secondary">Driver: <strong>{booking.driverName}</strong></span>
                  <span className="text-xs text-primary">⭐ {booking.driverRating}</span>
                </div>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default ActivityPage;
