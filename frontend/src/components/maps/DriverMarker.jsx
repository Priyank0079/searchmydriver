import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { OverlayViewF, OverlayView } from '@react-google-maps/api';
import { PIN_ASSETS, MAP_Z_INDEX } from '../../constants/mapTheme';

/**
 * <DriverMarker /> — animated driver pin used on every live-trip map.
 *
 * Why a custom overlay (vs `<MarkerF>`):
 *   - The classic `Marker` and the new `AdvancedMarkerElement` both snap
 *     directly to the prop position, which makes a polled / Firebase-fed
 *     driver visibly *jump* every update. To get Rapido/Uber's "gliding"
 *     feel we have to interpolate between successive samples ourselves,
 *     and `OverlayView` lets us paint a rotatable HTML element at the
 *     interpolated coordinate without fighting Google's marker layer.
 *
 *   - Image icons on classic Markers can't be rotated (the `rotation`
 *     property only applies to SVG-path icons). An HTML overlay can be
 *     rotated with a single CSS transform — we get high-fidelity heading
 *     visuals essentially for free.
 *
 * Behaviour:
 *   - Interpolates lat/lng linearly between the previous and current props
 *     using `requestAnimationFrame` and an ease-in-out curve so the pin
 *     accelerates out of stops and decelerates into the next sample. This
 *     mimics how navigation apps smooth out 1-2 Hz GPS data.
 *   - If `heading` is provided (Firebase emits it from the driver's compass
 *     when available) we rotate to that exact bearing. Otherwise we derive
 *     a bearing from the previous→current segment so the pin always faces
 *     the direction of travel.
 *   - Picks the shortest rotation arc (e.g. 350°→10° goes via 0°, not the
 *     long way around) so the marker never spins through stationary
 *     points.
 */

const DEFAULT_ANIMATE_MS = 1100;

/** Standard ease-in-out cubic — soft accel + decel. */
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
}

/**
 * Initial-bearing (forward azimuth) from A→B in degrees, normalised
 * to `[0, 360)`. Used when the caller didn't ship an explicit heading.
 */
function bearingBetween(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((toDeg(Math.atan2(y, x)) + 360) % 360);
}

/** Shortest-arc heading interpolation. */
function lerpHeading(from, to, t) {
  let delta = to - from;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return ((from + delta * t) % 360 + 360) % 360;
}

const getPixelPositionOffset = (width, height) => ({
  x: -width / 2,
  // Anchor at center (icon centre sits on the lat/lng). For pin-style
  // graphics with a "tail" pointing down, switch to `-height + tailOffset`
  // — but our driver assets are circular medallions, centre-anchored.
  y: -height / 2,
});

function DriverMarker({
  position,
  heading,
  animateMs = DEFAULT_ANIMATE_MS,
  imageSrc = PIN_ASSETS.DRIVER,
  size = 46,
  rotate = true,
  pulse = true,
  ariaLabel = 'Driver',
}) {
  // Animated state — what the screen actually shows on this frame.
  const [renderedPosition, setRenderedPosition] = useState(position || null);
  const [renderedHeading, setRenderedHeading] = useState(
    typeof heading === 'number' ? heading : 0,
  );

  // Persisted previous values used by the next interpolation cycle.
  const previousRef = useRef({
    position: position || null,
    heading: typeof heading === 'number' ? heading : 0,
  });
  const rafRef = useRef(null);

  useEffect(() => {
    if (!position) return undefined;

    const start = previousRef.current.position || position;
    const end = position;
    // If neither start nor end actually changed, skip animation entirely.
    if (
      start &&
      Math.abs(start.lat - end.lat) < 1e-7 &&
      Math.abs(start.lng - end.lng) < 1e-7
    ) {
      if (typeof heading === 'number') {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- snap heading when only rotation changes
        setRenderedHeading(heading);
      }
      previousRef.current = {
        position: end,
        heading: typeof heading === 'number' ? heading : previousRef.current.heading,
      };
      return undefined;
    }

    const fromHeading = previousRef.current.heading;
    const toHeading =
      typeof heading === 'number' ? heading : bearingBetween(start, end);

    let startTs = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const tick = (ts) => {
      if (startTs == null) startTs = ts;
      const progress = Math.min(1, (ts - startTs) / Math.max(1, animateMs));
      const eased = easeInOutCubic(progress);

      // Linear interpolation in lat/lng space. For city-scale distances
      // (< few km between samples) this is visually indistinguishable
      // from a great-circle interpolation but costs ~10× less.
      setRenderedPosition({
        lat: start.lat + (end.lat - start.lat) * eased,
        lng: start.lng + (end.lng - start.lng) * eased,
      });
      setRenderedHeading(lerpHeading(fromHeading, toHeading, eased));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    // Once we've kicked off the animation, the *new* target is what the
    // next sample will interpolate *from* — record it eagerly.
    previousRef.current = { position: end, heading: toHeading };

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [position, heading, animateMs]);

  // Cleanup on unmount.
  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  const containerStyle = useMemo(
    () => ({
      width: size,
      height: size,
      transform: rotate ? `rotate(${renderedHeading}deg)` : 'none',
      transformOrigin: '50% 50%',
      // CSS easing softens the very last sub-degree of rotation between
      // animation frames so the pin doesn't appear to "vibrate" when a new
      // sample lands in the middle of a tick.
      transition: 'transform 120ms linear',
      pointerEvents: 'none',
      willChange: 'transform',
    }),
    [size, rotate, renderedHeading],
  );

  if (!renderedPosition) return null;

  return (
    <OverlayViewF
      position={renderedPosition}
      // FLOAT_PANE is the topmost pane — guarantees the live driver pin sits
      // above both the route polyline (OVERLAY_LAYER) and any static
      // pickup/drop pins (MARKER_LAYER). Critical during follow-camera so the
      // pin never gets visually buried by a thick polyline at sharp turns.
      mapPaneName={OverlayView.FLOAT_PANE}
      zIndex={MAP_Z_INDEX.DRIVER_MARKER}
      getPixelPositionOffset={getPixelPositionOffset}
    >
      <div style={containerStyle} aria-label={ariaLabel}>
        {pulse && (
          <span
            // Subtle radial pulse around the driver — the same "live"
            // indicator Rapido/Uber use to communicate active tracking.
            style={{
              position: 'absolute',
              inset: '-30%',
              borderRadius: '9999px',
              background:
                'radial-gradient(circle, rgba(31,138,76,0.35) 0%, rgba(31,138,76,0) 70%)',
              animation: 'gmap-driver-pulse 1800ms ease-out infinite',
              pointerEvents: 'none',
            }}
          />
        )}
        <img
          src={imageSrc}
          alt={ariaLabel}
          draggable={false}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            filter: 'drop-shadow(0 4px 6px rgba(15, 23, 42, 0.30))',
            position: 'relative',
            zIndex: 1,
          }}
        />
        {/* Inline keyframes so we don't have to touch global CSS for one
            decorative animation. Scoped to this overlay because we only
            need it where the driver marker mounts. */}
        <style>{`
          @keyframes gmap-driver-pulse {
            0%   { transform: scale(0.7); opacity: 0.6; }
            70%  { transform: scale(1.2); opacity: 0.0; }
            100% { transform: scale(1.2); opacity: 0.0; }
          }
        `}</style>
      </div>
    </OverlayViewF>
  );
}

export default memo(DriverMarker);
