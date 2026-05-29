import { useCallback, useEffect, useRef, useState } from 'react';
import { useGoogleMap } from './useGoogleMap';
import { haversineMeters } from '../utils/geo';

/**
 * useDriverMovementSimulator — DEV-ONLY driver movement generator.
 *
 * Walks a virtual driver along a real Google Directions path between two
 * points and emits a steady stream of `{ lat, lng, heading, speed }`
 * samples — exactly like the Firebase Realtime DB feed would in
 * production. Use it to drive the trip-tracking map (`<TripTrackingMap>`,
 * `<DriverMarker>`, `<RoutePolyline>`) without needing a real driver to
 * physically move, so the smooth-animation, polyline, and follow-camera
 * logic can be verified end-to-end in a dev environment.
 *
 *   const sim = useDriverMovementSimulator({
 *     origin:      { lat, lng },     // where the driver starts
 *     destination: { lat, lng },     // where the driver is heading
 *     speedKmh:    40,               // can be changed live
 *     tickMs:      1000,             // emission cadence
 *   });
 *
 *   sim.driver   → latest position sample (or `null` until ready)
 *   sim.path     → decoded directions path the driver is following
 *   sim.status   → 'idle' | 'loading' | 'ready' | 'running' | 'paused' | 'finished' | 'error'
 *   sim.progress → 0..1 fraction of the path completed
 *   sim.start()  → kick off the simulation (or resume after pause / restart after finish)
 *   sim.pause()  → freeze the driver in place
 *   sim.reset()  → jump back to origin
 *
 * Why drive along a *real* directions path (vs a synthetic straight line)?
 *   The polyline rendered on screen comes from the same Directions API.
 *   Walking the simulated driver along that same geometry produces the
 *   most realistic test — we get sharp turns, varying segment lengths,
 *   and an honest heading at every point of the route. A straight-line
 *   simulator would never trigger the polyline-shrinks-as-driver-moves
 *   refetch the real pipeline relies on.
 */

const DEFAULT_TICK_MS = 1000;

/* Initial-bearing (forward azimuth) helper — duplicated locally so this
 * hook is self-contained and doesn't import from <DriverMarker>'s private
 * helpers. Returns degrees in `[0, 360)`. */
function bearingBetween(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/* Extract the most detailed path the API gives us. `overview_path` is the
 * smoothed summary; `legs[].steps[].path` retains every turn and is what
 * we want to walk so the simulated heading hits each junction. */
function extractFullPath(route) {
  const stepPaths = (route.legs || []).flatMap((leg) =>
    (leg.steps || []).flatMap((step) =>
      (step.path || []).map((p) => ({ lat: p.lat(), lng: p.lng() })),
    ),
  );
  if (stepPaths.length > 1) return stepPaths;
  return (route.overview_path || []).map((p) => ({ lat: p.lat(), lng: p.lng() }));
}

export function useDriverMovementSimulator({
  origin,
  destination,
  speedKmh = 30,
  tickMs = DEFAULT_TICK_MS,
} = {}) {
  const { isLoaded, maps } = useGoogleMap();

  const [path, setPath] = useState(null);
  const [driver, setDriver] = useState(null);
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState(0);

  /* ---------- Refs for the animation loop ---------- */
  // Index of the segment the driver is currently traversing (path[idx] → path[idx+1])
  const segmentIndexRef = useRef(0);
  // Position along the current segment, 0..1
  const segmentTRef = useRef(0);
  // Total meters traversed (used to derive progress without recomputing each tick)
  const metersTraversedRef = useRef(0);
  // Total path length in meters (denominator for progress)
  const totalMetersRef = useRef(0);
  // Latest speed setting — held in a ref so the running interval picks up
  // slider changes without us having to tear it down and rebuild it.
  const speedRef = useRef(speedKmh);
  // Interval id while running.
  const intervalIdRef = useRef(null);

  useEffect(() => {
    speedRef.current = speedKmh;
  }, [speedKmh]);

  /* ---------- Fetch the directions path whenever the endpoints change ---- */
  useEffect(() => {
    if (!isLoaded || !maps) return undefined;
    if (
      !origin ||
      !destination ||
      typeof origin.lat !== 'number' ||
      typeof origin.lng !== 'number' ||
      typeof destination.lat !== 'number' ||
      typeof destination.lng !== 'number'
    ) {
      return undefined;
    }

    // Hard reset whatever was running before — endpoints changed.
    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }
    segmentIndexRef.current = 0;
    segmentTRef.current = 0;
    metersTraversedRef.current = 0;

    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- announce that a new directions request is in flight
    setStatus('loading');
    setPath(null);

    const service = new maps.DirectionsService();
    service.route(
      {
        origin: { lat: origin.lat, lng: origin.lng },
        destination: { lat: destination.lat, lng: destination.lng },
        travelMode: maps.TravelMode?.DRIVING || 'DRIVING',
      },
      (result, dirStatus) => {
        if (cancelled) return;
        if (dirStatus !== 'OK' || !result?.routes?.[0]) {
          setStatus('error');
          return;
        }
        const fullPath = extractFullPath(result.routes[0]);
        if (!fullPath || fullPath.length < 2) {
          setStatus('error');
          return;
        }
        // Pre-compute total length so `progress` is cheap each tick.
        let total = 0;
        for (let i = 1; i < fullPath.length; i += 1) {
          total += haversineMeters(fullPath[i - 1], fullPath[i]);
        }
        totalMetersRef.current = total;

        setPath(fullPath);
        setDriver({
          lat: fullPath[0].lat,
          lng: fullPath[0].lng,
          heading: bearingBetween(fullPath[0], fullPath[1]),
          speed: 0,
        });
        setProgress(0);
        setStatus('ready');
      },
    );

    return () => {
      cancelled = true;
    };
    // We only re-run when the actual coordinate values change. The
    // `origin`/`destination` object identities can churn even when the
    // numbers don't (parent re-renders), and we don't want to refetch
    // Directions on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, maps, origin?.lat, origin?.lng, destination?.lat, destination?.lng]);

  /* ---------- The simulation step ----------------------------------------
   * Each tick we:
   *   1. Compute the distance the driver should cover this interval based
   *      on the current speed (`speedKmh * tickMs / 3600` metres).
   *   2. Walk along the precomputed path, advancing through one or more
   *      segments until we exhaust that distance budget.
   *   3. Interpolate lat/lng linearly along the current segment.
   *   4. Compute the heading from the current segment's direction so the
   *      driver pin "looks" the right way.
   *   5. Update progress as a fraction of the full path length.
   * --------------------------------------------------------------------- */
  const tick = useCallback(() => {
    const localPath = path;
    if (!localPath || localPath.length < 2) return;

    const metersPerTick = (speedRef.current * tickMs) / 3600;
    if (metersPerTick <= 0) return;

    let remaining = metersPerTick;
    let idx = segmentIndexRef.current;
    let segT = segmentTRef.current;

    while (remaining > 0 && idx < localPath.length - 1) {
      const a = localPath[idx];
      const b = localPath[idx + 1];
      const segLen = haversineMeters(a, b);
      // Degenerate "zero-length" segments (duplicate points) are skipped
      // outright — otherwise division by zero below would NaN the driver.
      if (!Number.isFinite(segLen) || segLen <= 0.001) {
        idx += 1;
        segT = 0;
        continue;
      }
      const remainingInSegment = segLen * (1 - segT);
      if (remaining < remainingInSegment) {
        segT += remaining / segLen;
        metersTraversedRef.current += remaining;
        remaining = 0;
      } else {
        metersTraversedRef.current += remainingInSegment;
        remaining -= remainingInSegment;
        idx += 1;
        segT = 0;
      }
    }

    segmentIndexRef.current = idx;
    segmentTRef.current = segT;

    // Reached the destination — snap to the last vertex and stop.
    if (idx >= localPath.length - 1) {
      const last = localPath[localPath.length - 1];
      setDriver({
        lat: last.lat,
        lng: last.lng,
        heading: bearingBetween(localPath[localPath.length - 2], last),
        speed: 0,
      });
      setProgress(1);
      setStatus('finished');
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
      return;
    }

    const a = localPath[idx];
    const b = localPath[idx + 1];
    setDriver({
      lat: a.lat + (b.lat - a.lat) * segT,
      lng: a.lng + (b.lng - a.lng) * segT,
      heading: bearingBetween(a, b),
      speed: speedRef.current,
    });
    setProgress(
      totalMetersRef.current > 0
        ? Math.min(1, metersTraversedRef.current / totalMetersRef.current)
        : 0,
    );
  }, [path, tickMs]);

  /* ---------- Controls ------------------------------------------------- */
  const start = useCallback(() => {
    if (!path) return;
    // If we'd previously hit the destination, rewind so the next start is
    // a full replay instead of a no-op.
    if (status === 'finished') {
      segmentIndexRef.current = 0;
      segmentTRef.current = 0;
      metersTraversedRef.current = 0;
      setDriver({
        lat: path[0].lat,
        lng: path[0].lng,
        heading: bearingBetween(path[0], path[1]),
        speed: 0,
      });
      setProgress(0);
    }
    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current);
    }
    intervalIdRef.current = setInterval(tick, tickMs);
    setStatus('running');
  }, [path, status, tick, tickMs]);

  const pause = useCallback(() => {
    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }
    setStatus((prev) => (prev === 'running' ? 'paused' : prev));
  }, []);

  const reset = useCallback(() => {
    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }
    segmentIndexRef.current = 0;
    segmentTRef.current = 0;
    metersTraversedRef.current = 0;
    if (path && path.length >= 2) {
      setDriver({
        lat: path[0].lat,
        lng: path[0].lng,
        heading: bearingBetween(path[0], path[1]),
        speed: 0,
      });
      setProgress(0);
      setStatus('ready');
    } else {
      setDriver(null);
      setProgress(0);
      setStatus(path ? 'ready' : 'idle');
    }
  }, [path]);

  /* ---------- Cleanup -------------------------------------------------- */
  useEffect(
    () => () => {
      if (intervalIdRef.current) clearInterval(intervalIdRef.current);
    },
    [],
  );

  return {
    driver,
    path,
    status,
    progress,
    start,
    pause,
    reset,
  };
}

export default useDriverMovementSimulator;
