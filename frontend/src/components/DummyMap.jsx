import { MapPin, Navigation } from 'lucide-react';

/**
 * DummyMap — A realistic-looking static map placeholder with driver pins.
 * @param {string}  className   - Additional wrapper classes
 * @param {boolean} showDriverPins  - Render driver marker dots
 * @param {boolean} showRoute       - Render a faux route line
 * @param {string}  label           - Optional center label text
 * @param {number}  height          - Optional explicit height (in px)
 */
const DummyMap = ({
  className = '',
  showDriverPins = false,
  showRoute = false,
  label,
  height,
  children,
}) => {
  // Mock driver pin positions (% from top-left)
  const driverPins = [
    { top: '30%', left: '25%', delay: '0s' },
    { top: '55%', left: '65%', delay: '0.3s' },
    { top: '40%', left: '80%', delay: '0.6s' },
    { top: '70%', left: '35%', delay: '0.9s' },
    { top: '20%', left: '55%', delay: '1.2s' },
  ];

  return (
    <div
      className={`relative overflow-hidden bg-[#e8f0e8] ${className}`}
      style={height ? { height } : {}}
    >
      {/* Map grid lines (streets) */}
      <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
        {/* Horizontal streets */}
        <line x1="0" y1="20%" x2="100%" y2="20%" stroke="#d4ddd4" strokeWidth="2" />
        <line x1="0" y1="40%" x2="100%" y2="40%" stroke="#d4ddd4" strokeWidth="2" />
        <line x1="0" y1="60%" x2="100%" y2="60%" stroke="#d4ddd4" strokeWidth="2" />
        <line x1="0" y1="80%" x2="100%" y2="80%" stroke="#d4ddd4" strokeWidth="2" />

        {/* Vertical streets */}
        <line x1="20%" y1="0" x2="20%" y2="100%" stroke="#d4ddd4" strokeWidth="2" />
        <line x1="45%" y1="0" x2="45%" y2="100%" stroke="#d4ddd4" strokeWidth="2" />
        <line x1="70%" y1="0" x2="70%" y2="100%" stroke="#d4ddd4" strokeWidth="2" />

        {/* Main roads (wider) */}
        <line x1="0" y1="50%" x2="100%" y2="50%" stroke="#c8d4c8" strokeWidth="6" />
        <line x1="50%" y1="0" x2="50%" y2="100%" stroke="#c8d4c8" strokeWidth="6" />

        {/* Diagonal road */}
        <line x1="10%" y1="90%" x2="90%" y2="10%" stroke="#c8d4c8" strokeWidth="4" />

        {/* Route line */}
        {showRoute && (
          <polyline
            points="120,250 180,200 250,210 320,150 380,100"
            fill="none"
            stroke="#3498DB"
            strokeWidth="4"
            strokeDasharray="8,6"
            strokeLinecap="round"
            className="animate-pulse"
          />
        )}
      </svg>

      {/* Green area blocks (parks) */}
      <div className="absolute top-[10%] left-[5%] w-16 h-12 bg-[#c5e1a5]/60 rounded-lg" />
      <div className="absolute bottom-[15%] right-[10%] w-20 h-14 bg-[#c5e1a5]/60 rounded-lg" />
      <div className="absolute top-[60%] left-[30%] w-12 h-10 bg-[#c5e1a5]/50 rounded-md" />

      {/* Building blocks */}
      <div className="absolute top-[25%] left-[60%] w-10 h-8 bg-[#d5d5d5]/50 rounded-sm" />
      <div className="absolute top-[70%] left-[15%] w-14 h-8 bg-[#d5d5d5]/50 rounded-sm" />
      <div className="absolute top-[15%] right-[20%] w-12 h-10 bg-[#d5d5d5]/40 rounded-sm" />

      {/* Center pin (user location) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
        <div className="relative">
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center shadow-lg shadow-primary/30 ring-4 ring-primary/20">
            <MapPin className="w-4 h-4 text-dark" />
          </div>
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-primary rotate-45" />
        </div>
      </div>

      {/* Driver pins */}
      {showDriverPins &&
        driverPins.map((pin, i) => (
          <div
            key={i}
            className="absolute z-10 animate-bounce-in"
            style={{ top: pin.top, left: pin.left, animationDelay: pin.delay }}
          >
            <div className="w-7 h-7 bg-dark rounded-full flex items-center justify-center shadow-md ring-2 ring-white">
              <Navigation className="w-3 h-3 text-primary" />
            </div>
          </div>
        ))}

      {/* Center label */}
      {label && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-sm">
          <p className="text-xs font-medium text-text whitespace-nowrap">{label}</p>
        </div>
      )}

      {/* Children overlay */}
      {children}
    </div>
  );
};

export default DummyMap;
