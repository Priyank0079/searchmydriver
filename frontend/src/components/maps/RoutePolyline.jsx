import { memo, useEffect, useMemo, useState } from 'react';
import { PolylineF } from '@react-google-maps/api';
import { ROUTE_POLYLINE, MAP_Z_INDEX } from '../../constants/mapTheme';

/**
 * <RoutePolyline /> — themable polyline for the live-trip map.
 *
 * Two rendering modes:
 *   1. With outline (`showOutline = true`, the default)
 *      → draws a translucent halo behind a sharp inner stroke for the
 *        Uber/Rapido "premium" double-line look.
 *   2. Without outline (`showOutline = false`)
 *      → renders a single clean stroke — useful when the map is dense
 *        with markers and the halo looks visually noisy.
 *
 * The default colour, opacity and weight all come from
 * `ROUTE_POLYLINE` in `constants/mapTheme.js` — change them there and
 * every consumer (live trip, dev simulator, future maps) updates at
 * once. Per-instance overrides still go through `strokeOptions` /
 * `outlineOptions`.
 *
 * Polyline source flexibility:
 *   - `path`    : already-decoded `[{ lat, lng }, …]` (preferred — that's
 *                  what `useDirectionsRoute` returns).
 *   - `encoded` : an encoded Polyline string from the Directions API.
 *                 We decode it on demand using
 *                 `google.maps.geometry.encoding.decodePath`, which is
 *                 always available because the `geometry` library is
 *                 part of the loader's default libraries.
 *
 * Draw animation:
 *   - When `animate` is true (the default) we progressively reveal the
 *     polyline by slicing the path inside a `requestAnimationFrame` loop.
 *     Total reveal time is `animationMs`. Re-runs whenever a fresh path
 *     arrives so the user sees the "drawing in" effect every time
 *     Directions returns a new route (e.g. after a long stop).
 *   - Set `animate={false}` for cases where the polyline is meant to be
 *     stable (e.g. completed-trip summary maps).
 */

/* Compose the per-render polyline options from the central theme. Kept as a
 * pure function so the merge happens deterministically every render without
 * leaking memoised stale options between consumers. */
function buildOutlineOptions(overrides) {
  return {
    ...ROUTE_POLYLINE.OUTLINE,
    zIndex: MAP_Z_INDEX.POLYLINE_OUTLINE,
    ...(overrides || {}),
  };
}

function buildStrokeOptions(overrides) {
  return {
    ...ROUTE_POLYLINE.STROKE,
    zIndex: MAP_Z_INDEX.POLYLINE_STROKE,
    ...(overrides || {}),
  };
}

/**
 * Decode whichever shape the caller passed:
 *   - `null` / `undefined`  → returns `null`
 *   - array of LatLngLiteral → passes through unchanged
 *   - encoded polyline string → decoded via `geometry.encoding.decodePath`
 *
 * Decoding is intentionally lazy — `decodePath` is only called once per
 * `encoded` prop change, never on every render, so even very long
 * polylines are cheap.
 */
function decodePath(input) {
  if (!input) return null;
  if (Array.isArray(input)) return input;
  if (typeof input !== 'string') return null;
  if (typeof window === 'undefined') return null;
  const enc = window.google?.maps?.geometry?.encoding;
  if (!enc?.decodePath) return null;
  try {
    return enc.decodePath(input).map((p) => ({ lat: p.lat(), lng: p.lng() }));
  } catch {
    return null;
  }
}

function RoutePolyline({
  path,
  encoded,
  animate = true,
  animationMs = 900,
  outlineOptions,
  strokeOptions,
  dashed = false,
  showOutline = ROUTE_POLYLINE.OUTLINE_DEFAULT,
}) {
  // Resolve the source-of-truth path once per change. We hold onto the
  // decoded array via memo so re-renders triggered by an outer state
  // change (animation tick on the parent map) don't re-decode the string.
  const fullPath = useMemo(() => decodePath(path) || decodePath(encoded), [path, encoded]);

  // Progressive reveal — `displayedPath` is what we actually feed into the
  // two `<PolylineF>` layers each tick. We grow it from a 2-point seed up
  // to the full length over `animationMs`.
  const [displayedPath, setDisplayedPath] = useState(null);

  useEffect(() => {
    if (!fullPath || fullPath.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear when path becomes empty
      setDisplayedPath(null);
      return undefined;
    }
    if (!animate) {
      setDisplayedPath(fullPath);
      return undefined;
    }

    let frame;
    let startTs = null;
    const total = Math.max(2, fullPath.length);
    const step = (ts) => {
      if (startTs == null) startTs = ts;
      const t = Math.min(1, (ts - startTs) / Math.max(1, animationMs));
      // Slight ease-out so the line "settles" instead of stopping abruptly.
      const eased = 1 - (1 - t) ** 2;
      const count = Math.max(2, Math.ceil(eased * total));
      setDisplayedPath(fullPath.slice(0, count));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => {
      if (frame) cancelAnimationFrame(frame);
    };
  }, [fullPath, animate, animationMs]);

  // Dashed variant — used as the "still resolving" placeholder line in
  // `<TripTrackingMap>` before Directions returns. Implemented with the
  // `icons` field so the underlying stroke can remain invisible.
  const dashedOptions = useMemo(() => {
    if (!dashed) return null;
    if (typeof window === 'undefined' || !window.google?.maps) return null;
    const fillColor =
      strokeOptions?.strokeColor || ROUTE_POLYLINE.DASHED.strokeColor;
    return {
      strokeOpacity: 0,
      zIndex: 0,
      clickable: false,
      icons: [
        {
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            fillColor,
            fillOpacity: 0.85,
            strokeOpacity: 0,
            scale: ROUTE_POLYLINE.DASHED.dotScale,
          },
          offset: '0',
          repeat: ROUTE_POLYLINE.DASHED.repeat,
        },
      ],
    };
  }, [dashed, strokeOptions?.strokeColor]);

  if (!displayedPath || displayedPath.length < 2) return null;

  // Dashed-line mode renders a single layer (no outline + no fill stroke).
  if (dashed && dashedOptions) {
    return <PolylineF path={displayedPath} options={dashedOptions} />;
  }

  const stroke = buildStrokeOptions(strokeOptions);

  // Single-stroke mode — outline disabled. The polyline reads as a clean
  // one-pixel-style line, which sits more quietly under dense markers.
  if (!showOutline) {
    return <PolylineF path={displayedPath} options={stroke} />;
  }

  const outline = buildOutlineOptions(outlineOptions);

  return (
    <>
      <PolylineF path={displayedPath} options={outline} />
      <PolylineF path={displayedPath} options={stroke} />
    </>
  );
}

export default memo(RoutePolyline);
