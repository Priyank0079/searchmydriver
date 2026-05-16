import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../../../components/Card';
import Avatar from '../../../../components/Avatar';
import Badge from '../../../../components/Badge';
import DummyMap from '../../../../components/DummyMap';
import { Search, MapPin, Star, Bell, ChevronUp, ChevronDown, X } from 'lucide-react';
import { SERVICE_TYPES, MOCK_DRIVERS } from '../../../../utils/constants';

const NEARBY_DRIVERS = [
  ...MOCK_DRIVERS,
  { id: '4', name: 'Pradeep Singh', rating: 4.7, trips: 560, distance: '2.5 km', eta: '9 min', phone: '+91 98765 43213', vehicleType: 'car', avatar: null },
  { id: '5', name: 'Vikram Patel', rating: 4.5, trips: 340, distance: '3.0 km', eta: '11 min', phone: '+91 98765 43214', vehicleType: 'car', avatar: null },
];

const UserHomePage = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [showDriverSheet, setShowDriverSheet] = useState(false);
  const mapRef = useRef(null);
  const scrollRef = useRef(null);

  // Observe when the map touches the sticky header
  const handleScroll = useCallback(() => {
    if (!mapRef.current || !scrollRef.current) return;
    const mapRect = mapRef.current.getBoundingClientRect();
    // sticky header is ~120px tall; when map top reaches header bottom, open sheet
    const headerBottom = 120;
    if (mapRect.top <= headerBottom && !showDriverSheet) {
      setShowDriverSheet(true);
    }
  }, [showDriverSheet]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  return (
    <div className="flex-1 flex flex-col bg-bg relative">
      {/* ====== Sticky Header ====== */}
      <div className="sticky top-0 z-30 bg-dark px-4 pt-4 pb-4 rounded-b-3xl shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-white/60 text-xs">Your location</p>
            <div className="flex items-center gap-1 mt-0.5">
              <MapPin className="w-4 h-4 text-primary" />
              <span className="text-white text-sm font-medium">Indore, Madhya Pradesh</span>
            </div>
          </div>
          <button className="relative p-2.5 rounded-xl bg-white/10 hover:bg-white/15 transition-colors">
            <Bell className="w-5 h-5 text-white" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger rounded-full" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
          <input
            type="text"
            placeholder="Where would you like to go?"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-11 bg-white rounded-2xl pl-12 pr-4 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 shadow-md"
          />
        </div>
      </div>

      {/* ====== Scrollable Content ====== */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-5">
          {/* Quick Services */}
          <div className="animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-text">Book a Driver</h2>
              <button className="text-xs text-primary font-medium hover:underline">View All</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {SERVICE_TYPES.map((service) => (
                <Card
                  key={service.id}
                  hoverable
                  onClick={() => navigate('/user/book/service')}
                  className="!p-3"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${service.color}15` }}
                    >
                      <span className="text-lg" style={{ color: service.color }}>
                        {service.id === 'point-to-point' ? '📍' : service.id === 'hourly' ? '⏰' : service.id === 'full-day' ? '☀️' : '🚗'}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xs font-semibold text-text truncate">{service.title}</h3>
                      <p className="text-[10px] text-text-muted truncate">{service.description}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Nearby Drivers — Map Section */}
          <div className="animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-text">Nearby Drivers</h2>
              <Badge variant="success">{NEARBY_DRIVERS.length} available nearby</Badge>
            </div>

            {/* Dummy Map */}
            <div ref={mapRef} className="rounded-2xl overflow-hidden shadow-card">
              <DummyMap
                className="h-64 rounded-2xl"
                showDriverPins
                label={`${NEARBY_DRIVERS.length} drivers available nearby`}
              />
            </div>

            {/* Tap to expand hint */}
            <button
              onClick={() => setShowDriverSheet(true)}
              className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 bg-white rounded-2xl shadow-card text-sm font-medium text-text-secondary hover:bg-gray-50 transition-colors"
            >
              <ChevronUp className="w-4 h-4 text-primary" />
              View {NEARBY_DRIVERS.length} nearby drivers
            </button>
          </div>
        </div>

        {/* Bottom spacer so user can scroll map to header */}
        <div className="h-40" />
      </div>

      {/* ====== Nearby Drivers Bottom Sheet ====== */}
      {showDriverSheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowDriverSheet(false)}
          />

          {/* Sheet */}
          <div className="relative bg-white rounded-t-3xl w-full max-w-lg animate-slide-up shadow-xl">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-2">
              <div>
                <h3 className="text-lg font-bold text-text">Nearby Drivers</h3>
                <p className="text-xs text-text-muted">{NEARBY_DRIVERS.length} drivers in your area</p>
              </div>
              <button
                onClick={() => setShowDriverSheet(false)}
                className="p-2 rounded-full hover:bg-gray-100 text-text-secondary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Driver List */}
            <div className="px-5 pb-8 space-y-3 max-h-[55vh] overflow-y-auto">
              {NEARBY_DRIVERS.map((driver, idx) => (
                <div
                  key={driver.id}
                  className="flex items-center gap-3 p-3 bg-bg rounded-2xl animate-fade-in-up cursor-pointer hover:shadow-md transition-shadow"
                  style={{ animationDelay: `${idx * 0.06}s` }}
                  onClick={() => { setShowDriverSheet(false); navigate('/user/book/service'); }}
                >
                  <Avatar name={driver.name} size="lg" online />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-text text-sm">{driver.name}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="flex items-center gap-0.5 text-xs text-text-secondary">
                        <Star className="w-3 h-3 text-primary fill-primary" />
                        {driver.rating}
                      </span>
                      <span className="text-xs text-text-muted">·</span>
                      <span className="text-xs text-text-muted">{driver.trips} trips</span>
                    </div>
                    <p className="text-xs text-success font-medium mt-0.5">{driver.distance} away · {driver.eta}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowDriverSheet(false); navigate('/user/book/service'); }}
                    className="px-3.5 py-2 bg-primary rounded-xl text-xs font-bold text-dark hover:bg-primary-dark transition-colors shrink-0"
                  >
                    Book
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserHomePage;
