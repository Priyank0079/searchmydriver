import { useState } from 'react';
import Card from '../../../../components/Card';
import Badge from '../../../../components/Badge';
import { MapPin, Clock } from 'lucide-react';
import { MOCK_DRIVER_TRIPS } from '../../../../utils/constants';

const tabs = ['All', 'Ongoing', 'Completed'];

const MyTripsPage = () => {
  const [activeTab, setActiveTab] = useState('All');

  const filtered = activeTab === 'All' ? MOCK_DRIVER_TRIPS
    : MOCK_DRIVER_TRIPS.filter((t) => t.status === activeTab.toLowerCase());

  return (
    <div className="flex-1 flex flex-col bg-bg">
      <div className="bg-white px-4 pt-4 pb-0 shadow-sm">
        <h1 className="text-lg font-bold text-text mb-3">My Trips</h1>
        <div className="flex gap-1 -mx-4 px-4 pb-0">
          {tabs.map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors
                ${activeTab === tab ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-text-muted'}`}>
              {tab}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 p-4 space-y-3">
        {filtered.map((trip, idx) => (
          <Card key={trip.id} hoverable className="animate-fade-in-up" style={{ animationDelay: `${idx * 0.06}s` }}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <span className="text-xs text-text-muted">{trip.fullDate}</span>
                <span className="text-xs text-text-muted ml-2">{trip.date}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="success">{trip.status}</Badge>
                <span className="text-sm font-bold text-success">₹{trip.fare}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-text-secondary mb-1">
              <MapPin className="w-3.5 h-3.5 text-success shrink-0" />
              {trip.pickup}
            </div>
            {trip.drop && (
              <div className="flex items-center gap-2 text-xs text-text-muted mb-2">
                <MapPin className="w-3.5 h-3.5 text-danger shrink-0" />
                {trip.drop}
              </div>
            )}
            <div className="flex items-center gap-3 text-xs text-text-muted">
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{trip.duration}</span>
              <span>{trip.distance}</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default MyTripsPage;
