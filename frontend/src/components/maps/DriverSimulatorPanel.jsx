import { memo } from 'react';
import { Play, Pause, RotateCcw, Gauge, Loader2, FlagTriangleRight } from 'lucide-react';

/**
 * <DriverSimulatorPanel /> — DEV-ONLY control surface for
 * `useDriverMovementSimulator`. Renders Start / Pause / Reset, a speed
 * slider, a progress bar and the latest sample (lat/lng/heading/speed)
 * so a developer can verify the trip map's animation, polyline shrink,
 * and follow-camera in a single screen without needing a real driver.
 *
 * The panel itself contains no simulation logic — it's a thin view over
 * the props the hook returns and the setters the parent wires up. This
 * keeps it trivial to drop next to ANY map (e.g. the dev simulator page,
 * a future Storybook demo, or an admin debug overlay).
 */

const STATUS_LABEL = {
  idle: { label: 'Idle', tone: 'text-text-muted' },
  loading: { label: 'Loading route…', tone: 'text-text-muted' },
  ready: { label: 'Ready', tone: 'text-primary-dark' },
  running: { label: 'Running', tone: 'text-emerald-600' },
  paused: { label: 'Paused', tone: 'text-amber-600' },
  finished: { label: 'Finished', tone: 'text-emerald-700' },
  error: { label: 'Route error', tone: 'text-rose-600' },
};

function StatusPill({ status }) {
  const { label, tone } = STATUS_LABEL[status] || STATUS_LABEL.idle;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${tone}`}>
      {status === 'loading' ? <Loader2 className="w-3 h-3 animate-spin" /> : (
        <span className="w-1.5 h-1.5 rounded-full bg-current" />
      )}
      {label}
    </span>
  );
}

function DriverSimulatorPanel({
  status,
  progress = 0,
  driver,
  speedKmh,
  onStart,
  onPause,
  onReset,
  onSpeedChange,
  minSpeed = 5,
  maxSpeed = 120,
  className = '',
}) {
  const running = status === 'running';
  const startDisabled = status === 'idle' || status === 'loading' || status === 'error';
  const pauseDisabled = !running;
  const resetDisabled = status === 'idle' || status === 'loading';

  const progressPct = Math.max(0, Math.min(100, Math.round(progress * 100)));

  return (
    <div
      className={`rounded-2xl border border-amber-200 bg-amber-50/70 shadow-card p-3.5 space-y-3 ${className}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-amber-200/80 text-amber-900">
            <FlagTriangleRight className="w-4 h-4" />
          </span>
          <div>
            <p className="text-sm font-bold text-amber-900 leading-tight">Driver simulator</p>
            <p className="text-[10px] text-amber-800/70 leading-tight">
              Dev-only · walks a fake driver along the directions path
            </p>
          </div>
        </div>
        <StatusPill status={status} />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={onStart}
          disabled={startDisabled || running}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 text-white font-semibold text-sm py-2 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          <Play className="w-3.5 h-3.5" />
          {status === 'paused' ? 'Resume' : status === 'finished' ? 'Replay' : 'Start'}
        </button>
        <button
          type="button"
          onClick={onPause}
          disabled={pauseDisabled}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white border border-amber-300 text-amber-900 font-semibold text-sm py-2 hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          <Pause className="w-3.5 h-3.5" />
          Pause
        </button>
        <button
          type="button"
          onClick={onReset}
          disabled={resetDisabled}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white border border-amber-300 text-amber-900 font-semibold text-sm py-2 hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset
        </button>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-semibold text-amber-900 uppercase tracking-wide">
            Progress
          </span>
          <span className="text-[11px] font-mono text-amber-900">{progressPct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-amber-200/80 overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {onSpeedChange ? (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-900 uppercase tracking-wide">
              <Gauge className="w-3 h-3" />
              Speed
            </span>
            <span className="text-[11px] font-mono text-amber-900">{speedKmh} km/h</span>
          </div>
          <input
            type="range"
            min={minSpeed}
            max={maxSpeed}
            step={1}
            value={speedKmh}
            onChange={(e) => onSpeedChange(Number(e.target.value))}
            className="w-full accent-emerald-600"
          />
        </div>
      ) : null}

      {driver ? (
        <div className="rounded-xl bg-white/70 border border-amber-200/80 px-3 py-2 grid grid-cols-3 gap-2 text-[11px]">
          <div>
            <p className="text-[10px] text-amber-800/70 uppercase">Lat</p>
            <p className="font-mono text-amber-900">{driver.lat?.toFixed(5)}</p>
          </div>
          <div>
            <p className="text-[10px] text-amber-800/70 uppercase">Lng</p>
            <p className="font-mono text-amber-900">{driver.lng?.toFixed(5)}</p>
          </div>
          <div>
            <p className="text-[10px] text-amber-800/70 uppercase">Heading</p>
            <p className="font-mono text-amber-900">
              {typeof driver.heading === 'number' ? `${Math.round(driver.heading)}°` : '—'}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default memo(DriverSimulatorPanel);
