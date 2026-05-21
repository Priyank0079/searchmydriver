import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../../../components/Card';
import Toggle from '../../../../components/Toggle';
import { Star, TrendingUp, Bell, MapPin, Navigation, AlertCircle, ShieldAlert } from 'lucide-react';
import { useCachedQuery } from '../../../../hooks/useCachedQuery';
import { buildCacheKey } from '../../../../store/lib/buildCacheKey';
import { useDriverOnlineStore } from '../../../../store/driver/useDriverOnlineStore';
import { useDriverKitActiveStore } from '../../../../store/driver/useDriverKitStore';
import { useDriverOnlineToggle } from '../../../../hooks/useDriverOnlineToggle';
import { useDriverLocation } from '../../../../hooks/useDriverLocation';
import useDriverAuthStore from '../../../../store/useDriverAuthStore';
import OnlineBlockedDialog from '../../kit/components/OnlineBlockedDialog';
import DriverKitHomeCard from '../../kit/components/DriverKitHomeCard';

const DriverHomePage = () => {
  const navigate = useNavigate();
  const updateDriver = useDriverAuthStore((s) => s.updateDriver);
  const onlineKey = buildCacheKey('driver-online-status', {});
  const activeKey = buildCacheKey('driver-kit-active', {});

  const { data: onlineStatus, refetch: refetchOnline } = useCachedQuery(
    useDriverOnlineStore,
    onlineKey,
    {},
  );
  const { refetch: refetchKit } = useCachedQuery(useDriverKitActiveStore, activeKey, {});

  const { setOnline, toggling, blocked, clearBlocked } = useDriverOnlineToggle();

  const isOnline = onlineStatus?.isOnline ?? false;
  const canGoOnline = onlineStatus?.canGoOnline ?? false;
  const blocker = onlineStatus && !canGoOnline ? onlineStatus : null;
  const needsKitAction = blocker?.code === 'KIT_REQUIRED';
  const hasOtherBlocker = Boolean(blocker) && !needsKitAction;
  const primaryReason = blocker?.reasons?.[0] || null;

  const location = useDriverLocation({ enabled: isOnline });

  useEffect(() => {
    if (onlineStatus) {
      updateDriver({
        isOnline: onlineStatus.isOnline,
        canGoOnline: onlineStatus.canGoOnline,
      });
    }
  }, [onlineStatus, updateDriver]);

  const handleToggle = async (next) => {
    if (next) {
      const result = await setOnline(true);
      if (result.success) refetchOnline();
      return;
    }
    const result = await setOnline(false);
    if (result.success) refetchOnline();
  };

  const handleKitUpdate = () => {
    refetchKit();
    refetchOnline();
  };

  const goToKitPage = () => {
    clearBlocked();
    navigate('/driver/kit');
  };

  return (
    <div className="flex-1 flex flex-col bg-bg">
      <div className="bg-dark px-4 pt-4 pb-6 rounded-b-3xl">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-bold text-white">Home</h1>
          <button type="button" className="relative p-2.5 rounded-xl bg-white/10">
            <Bell className="w-5 h-5 text-white" />
          </button>
        </div>
        <Card className="!bg-white/10 backdrop-blur-sm !shadow-none">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-3 h-3 rounded-full ${isOnline ? 'bg-success animate-pulse' : 'bg-gray-400'}`}
              />
              <div>
                <span className="text-white text-sm font-medium block">
                  {isOnline ? 'You are Online' : 'You are Offline'}
                </span>
                {!isOnline && primaryReason && (
                  <span className="text-white/60 text-[10px]">{primaryReason}</span>
                )}
              </div>
            </div>
            <Toggle checked={isOnline} onChange={handleToggle} disabled={toggling} />
          </div>
        </Card>
      </div>

      <div className="flex-1 p-4 -mt-3 space-y-4 pb-8">
        {needsKitAction && <DriverKitHomeCard onUpdate={handleKitUpdate} />}

        {hasOtherBlocker && (
          <Card className="border-l-4 border-l-amber-500 bg-amber-50/40 animate-fade-in-up">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-text">Cannot go online yet</p>
                <ul className="mt-1.5 space-y-1">
                  {blocker.reasons.map((r) => (
                    <li key={r} className="text-xs text-text-muted leading-relaxed">
                      • {r}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        )}

        <Card className="animate-fade-in-up">
          <p className="text-xs text-text-muted mb-1">Today's Earnings</p>
          <p className="text-3xl font-bold text-text">₹850.00</p>
          <div className="flex items-center gap-6 mt-3">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-success" />
              <span className="text-sm">
                <strong>3</strong> <span className="text-text-muted">Trips</span>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Star className="w-4 h-4 text-primary fill-primary" />
              <span className="text-sm">
                <strong>5.0</strong> <span className="text-text-muted">Rating</span>
              </span>
            </div>
          </div>
        </Card>

        {isOnline && (
          <Card className="animate-fade-in-up border-l-4 border-l-success">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-success-light rounded-full flex items-center justify-center">
                <MapPin className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-sm font-medium text-text">You are online and ready to receive trips</p>
                <p className="text-xs text-text-muted mt-0.5">Incoming requests will appear here</p>
              </div>
            </div>
          </Card>
        )}

        {isOnline && location.error && location.permission === 'denied' && (
          <Card className="animate-fade-in-up border-l-4 border-l-danger">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-danger shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-text">Location permission blocked</p>
                <p className="text-xs text-text-muted mt-1">{location.error}</p>
              </div>
            </div>
          </Card>
        )}

        {isOnline && location.permission !== 'denied' && (
          <Card className="animate-fade-in-up">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  location.isSharing ? 'bg-primary/10' : 'bg-gray-100'
                }`}
              >
                <Navigation
                  className={`w-5 h-5 ${location.isSharing ? 'text-primary animate-pulse' : 'text-gray-400'}`}
                />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-text">
                  {location.isSharing ? 'Sharing live location' : 'Acquiring GPS signal…'}
                </p>
                <p className="text-xs text-text-muted mt-0.5">
                  {location.coords
                    ? `Accuracy ±${Math.round(location.coords.accuracy)}m · updated every 5s`
                    : 'Make sure you are in an open area for a faster fix.'}
                </p>
              </div>
            </div>
          </Card>
        )}

        {!isOnline && canGoOnline && (
          <Card className="border-l-4 border-l-gray-300">
            <p className="text-sm text-text-secondary text-center py-3">
              Turn on the switch above to start receiving booking requests
            </p>
          </Card>
        )}
      </div>

      <OnlineBlockedDialog
        open={Boolean(blocked)}
        onClose={clearBlocked}
        blocked={blocked}
        onGoToKit={goToKitPage}
      />
    </div>
  );
};

export default DriverHomePage;
