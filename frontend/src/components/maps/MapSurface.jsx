import { Loader2, MapPin } from 'lucide-react';

const MapSurface = ({
  mapRef,
  ready,
  error,
  height = 360,
  className = '',
  hint,
}) => (
  <div className={`relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 ${className}`}>
    <div ref={mapRef} className="w-full" style={{ height }} aria-label="Zone map editor" />

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

    {hint && ready && !error && (
      <p className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm px-3 py-2 text-[11px] text-slate-600 border-t border-slate-200 z-10">
        {hint}
      </p>
    )}
  </div>
);

export default MapSurface;
