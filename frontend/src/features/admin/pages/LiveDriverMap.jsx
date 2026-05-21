import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, MapPin, Users, Wifi, WifiOff, Car } from 'lucide-react';
import { useGoogleMaps } from '../../../hooks/useGoogleMaps';
import { useFirebaseDriverLocations } from '../../../hooks/useFirebaseDriverLocations';
import { useCachedQuery } from '../../../hooks/useCachedQuery';
import { buildCacheKey } from '../../../store/lib/buildCacheKey';
import { createQueryStore } from '../../../store/lib/createQueryStore';
import api from '../../../utils/api';
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, GOOGLE_MAP_ID } from '../../../constants/mapDefaults';

/* ------------------------------------------------------------------ */
/* Snapshot fetcher (Mongo seed)                                       */
/* ------------------------------------------------------------------ */

const useLiveDriversSnapshotStore = createQueryStore(async () => {
  const res = await api.get('/admin/drivers/live');
  return res.data?.data || { items: [], liveLocationReady: false };
});

/* ------------------------------------------------------------------ */
/* Merge logic — Firebase is authoritative; Mongo fills the gaps      */
/* ------------------------------------------------------------------ */

function mergeDrivers(mongoItems, firebaseMap) {
  const out = new Map();
  for (const m of mongoItems || []) {
    if (m.lat && m.lng) {
      out.set(String(m._id), {
        driverId: String(m._id),
        name: m.name,
        phone: m.phone,
        rating: m.rating,
        isOnTrip: m.isOnTrip,
        lat: m.lat,
        lng: m.lng,
        source: 'mongo',
        updatedAt: m.lastLocationAt ? new Date(m.lastLocationAt).getTime() : null,
      });
    }
  }
  for (const f of Object.values(firebaseMap || {})) {
    const existing = out.get(f.driverId);
    out.set(f.driverId, {
      ...(existing || { driverId: f.driverId }),
      lat: f.lat,
      lng: f.lng,
      accuracy: f.accuracy,
      heading: f.heading,
      speed: f.speed,
      updatedAt: f.updatedAt,
      isOnTrip: f.isOnTrip ?? existing?.isOnTrip,
      source: 'firebase',
    });
  }
  return Array.from(out.values());
}

function relativeTime(ts) {
  if (!ts) return '—';
  const diff = Math.max(0, Date.now() - ts);
  if (diff < 5_000) return 'just now';
  if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  return `${Math.round(diff / 3_600_000)}h ago`;
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

const LiveDriverMap = () => {
  const { maps, AdvancedMarkerElement, PinElement, ready, error } = useGoogleMaps();
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef(new Map()); // driverId → AdvancedMarkerElement
  const [selectedId, setSelectedId] = useState(null);

  // Live updates from Firebase.
  const { map: firebaseMap, disabled: firebaseDisabled, error: firebaseError } =
    useFirebaseDriverLocations();

  // Initial seed from Mongo.
  const cacheKey = buildCacheKey('admin-live-drivers', {});
  const { data: seed, refetch } = useCachedQuery(
    useLiveDriversSnapshotStore,
    cacheKey,
    {},
  );

  const drivers = useMemo(
    () => mergeDrivers(seed?.items, firebaseMap),
    [seed, firebaseMap],
  );

  /* ---- init map -------------------------------------------------- */

  useEffect(() => {
    if (!ready || !mapRef.current || mapInstanceRef.current) return;
    mapInstanceRef.current = new maps.Map(mapRef.current, {
      center: DEFAULT_MAP_CENTER,
      zoom: DEFAULT_MAP_ZOOM,
      mapId: GOOGLE_MAP_ID,
      disableDefaultUI: false,
      streetViewControl: false,
      mapTypeControl: false,
    });
  }, [ready, maps]);

  /* ---- sync markers --------------------------------------------- */

  useEffect(() => {
    if (!ready || !mapInstanceRef.current) return;

    const seenIds = new Set();

    for (const d of drivers) {
      seenIds.add(d.driverId);
      let marker = markersRef.current.get(d.driverId);
      if (!marker) {
        const pin = new PinElement({
          background: d.isOnTrip ? '#f97316' : '#22c55e',
          borderColor: '#0f172a',
          glyphColor: '#ffffff',
          scale: 1.0,
        });
        marker = new AdvancedMarkerElement({
          map: mapInstanceRef.current,
          position: { lat: d.lat, lng: d.lng },
          title: d.name || d.driverId,
          content: pin.element,
        });
        marker.addListener('click', () => setSelectedId(d.driverId));
        markersRef.current.set(d.driverId, marker);
      } else {
        marker.position = { lat: d.lat, lng: d.lng };
      }
    }

    // Remove stale markers (driver went offline).
    for (const [id, marker] of markersRef.current.entries()) {
      if (!seenIds.has(id)) {
        marker.map = null;
        markersRef.current.delete(id);
        if (selectedId === id) setSelectedId(null);
      }
    }
  }, [drivers, ready, AdvancedMarkerElement, PinElement, selectedId]);

  /* ---- recentre on first driver if map is on default --------------- */

  useEffect(() => {
    if (!ready || !mapInstanceRef.current) return;
    if (drivers.length === 0) return;
    const c = mapInstanceRef.current.getCenter();
    const isDefault =
      Math.abs(c.lat() - DEFAULT_MAP_CENTER.lat) < 0.001 &&
      Math.abs(c.lng() - DEFAULT_MAP_CENTER.lng) < 0.001;
    if (isDefault) {
      mapInstanceRef.current.panTo({ lat: drivers[0].lat, lng: drivers[0].lng });
    }
  }, [drivers, ready]);

  /* ---- focus a driver on click in side panel ----------------------- */

  const focusDriver = (driver) => {
    setSelectedId(driver.driverId);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.panTo({ lat: driver.lat, lng: driver.lng });
      mapInstanceRef.current.setZoom(15);
    }
  };

  /* ---- counts ----------------------------------------------------- */

  const onlineCount = drivers.length;
  const onTripCount = drivers.filter((d) => d.isOnTrip).length;

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Live driver map</h1>
        <p className="text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
          Real-time view of every online driver. Green markers are available, orange are on a trip.
        </p>
      </div>

      {firebaseDisabled && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Live updates are disabled — set <code className="font-mono">VITE_FIREBASE_*</code> in{' '}
          <code className="font-mono">frontend/.env</code> to enable real-time tracking. Showing
          Mongo snapshot only.
        </div>
      )}
      {firebaseError && !firebaseDisabled && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          Firebase subscription error: {firebaseError}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        <StatCard
          icon={Users}
          label="Online drivers"
          value={onlineCount}
          tone="success"
        />
        <StatCard icon={Car} label="On trip" value={onTripCount} tone="warning" />
        <StatCard
          icon={firebaseDisabled ? WifiOff : Wifi}
          label="Live feed"
          value={firebaseDisabled ? 'Off' : 'On'}
          tone={firebaseDisabled ? 'muted' : 'success'}
        />
        <button
          type="button"
          onClick={refetch}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
        >
          Refresh snapshot
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 min-h-[480px]">
          <div ref={mapRef} className="w-full h-[480px] lg:h-[640px]" aria-label="Live driver map" />
          {!ready && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-50/90 z-20">
              <Loader2 className="w-7 h-7 text-primary animate-spin" />
              <p className="text-sm text-slate-600">Loading map…</p>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-rose-50 p-4 text-center z-20">
              <MapPin className="w-8 h-8 text-rose-400" />
              <p className="text-sm font-medium text-rose-800">{error}</p>
            </div>
          )}
        </div>

        <DriverSidePanel
          drivers={drivers}
          selectedId={selectedId}
          onSelect={focusDriver}
        />
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Subcomponents                                                       */
/* ------------------------------------------------------------------ */

const TONE_STYLES = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  muted: 'bg-slate-50 text-slate-600 border-slate-200',
};

const StatCard = ({ icon: Icon, label, value, tone = 'muted' }) => (
  <div className={`rounded-xl border px-3 py-2.5 ${TONE_STYLES[tone]}`}>
    <div className="flex items-center gap-2">
      <Icon className="w-4 h-4" />
      <span className="text-[11px] font-medium uppercase tracking-wider">{label}</span>
    </div>
    <p className="text-2xl font-bold mt-1">{value}</p>
  </div>
);

const DriverSidePanel = ({ drivers, selectedId, onSelect }) => (
  <div className="rounded-xl border border-slate-200 bg-white max-h-[640px] overflow-y-auto custom-scrollbar">
    <div className="px-4 py-3 border-b border-slate-100 sticky top-0 bg-white z-10">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        Drivers ({drivers.length})
      </p>
    </div>
    {drivers.length === 0 ? (
      <div className="p-6 text-center">
        <p className="text-sm text-slate-500">No drivers online right now.</p>
      </div>
    ) : (
      <ul className="divide-y divide-slate-100">
        {drivers.map((d) => (
          <li key={d.driverId}>
            <button
              type="button"
              onClick={() => onSelect(d)}
              className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition ${
                selectedId === d.driverId ? 'bg-primary/5' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {d.name || d.driverId}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {d.lat.toFixed(4)}, {d.lng.toFixed(4)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      d.isOnTrip
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {d.isOnTrip ? 'On trip' : 'Available'}
                  </span>
                  <p className="text-[10px] text-slate-400 mt-1">{relativeTime(d.updatedAt)}</p>
                </div>
              </div>
            </button>
          </li>
        ))}
      </ul>
    )}
  </div>
);

export default LiveDriverMap;
