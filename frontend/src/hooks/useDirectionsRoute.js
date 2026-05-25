import { useEffect, useRef, useState } from 'react';
import { haversineMeters } from '../utils/geo';

/**
 * Pulls a road-following route between two LatLngs from
 * `google.maps.DirectionsService`. Built for the live trip-tracking map so
 * the line on screen follows actual streets — i.e. the Rapido/Uber look —
 * instead of a geodesic stripe through buildings.
 *
 *   const { path, distanceMeters, durationSeconds, status } =
 *     useDirectionsRoute({ maps, origin, destination, enabled });
 *
 * Why a custom hook (vs `DirectionsRenderer`)?
 *   - We already render our own pickup/driver pins with `AdvancedMarkerElement`,
 *     and `DirectionsRenderer` would either fight them (its default markers)
 *     or require `suppressMarkers: true` plus reading back the polyline path.
 *     A bare `DirectionsService` call keeps us in full control.
 *
 * Cost guard rails (DirectionsService is billed per request):
 *   - We skip a refetch if the destination is unchanged AND the origin moved
 *     less than `MIN_REFRESH_METERS`.
 *   - We never call more than once every `MIN_REFRESH_MS`, even if the
 *     driver is jittering on a stale GPS lock.
 *   - Once the driver is within `ARRIVAL_THRESHOLD_METERS` of the pickup we
 *     stop refreshing entirely — the existing line is good enough, and a
 *     fresh route would just oscillate as both endpoints converge.
 *
 * On failure (API not enabled, ZERO_RESULTS, OVER_QUERY_LIMIT, …) we keep
 * the previously-fetched path intact and surface the status so the caller
 * can decide whether to draw a fallback straight line.
 */

const MIN_REFRESH_MS = 10_000;
const MIN_REFRESH_METERS = 30;
const ARRIVAL_THRESHOLD_METERS = 80;

const sameLatLng = (a, b) =>
  !!a && !!b && a.lat === b.lat && a.lng === b.lng;

export function useDirectionsRoute({
  maps,
  origin,
  destination,
  travelMode = 'DRIVING',
  enabled = true,
}) {
  const [route, setRoute] = useState({
    path: null,
    distanceMeters: null,
    durationSeconds: null,
    status: 'idle',
  });

  const serviceRef = useRef(null);
  const lastOriginRef = useRef(null);
  const lastDestinationRef = useRef(null);
  const lastRequestAtRef = useRef(0);
  // Tracks whether we've ever successfully resolved a path. Used by the
  // "already-arrived, stop refetching" guard so we don't read `route.path`
  // (which would force the effect deps to include it).
  const hasPathRef = useRef(false);
  // Monotonically increasing request id. Every fired request stamps its
  // id and the callback bails if a newer request has been queued. We use
  // this instead of a per-effect `cancelled` flag because the previous
  // approach would mark the in-flight callback as cancelled whenever
  // origin jittered, but then the throttle below would skip kicking a
  // replacement — leaving the route permanently unresolved on noisy GPS.
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!enabled || !maps || !origin || !destination) return undefined;

    if (!serviceRef.current) {
      serviceRef.current = new maps.DirectionsService();
    }

    // If both endpoints are effectively unchanged AND we fetched recently,
    // bail WITHOUT touching the in-flight request. The previous request's
    // callback is still racing and will update state when it lands —
    // cancelling it would silently strand the polyline as a fallback.
    const prevOrigin = lastOriginRef.current;
    const prevDestination = lastDestinationRef.current;
    const destinationSame = sameLatLng(prevDestination, destination);
    const originBarelyMoved =
      prevOrigin && haversineMeters(prevOrigin, origin) < MIN_REFRESH_METERS;
    const recentlyFetched = Date.now() - lastRequestAtRef.current < MIN_REFRESH_MS;
    if (destinationSame && originBarelyMoved && recentlyFetched) {
      return undefined;
    }

    // Don't bother refreshing once the driver is essentially at pickup —
    // would otherwise produce noisy zero-length routes.
    const remaining = haversineMeters(origin, destination);
    if (
      Number.isFinite(remaining) &&
      remaining < ARRIVAL_THRESHOLD_METERS &&
      hasPathRef.current
    ) {
      return undefined;
    }

    requestIdRef.current += 1;
    const myReq = requestIdRef.current;
    lastOriginRef.current = origin;
    lastDestinationRef.current = destination;
    lastRequestAtRef.current = Date.now();

    const travel = maps.TravelMode?.[travelMode] || maps.TravelMode?.DRIVING;
    serviceRef.current.route(
      {
        origin: { lat: origin.lat, lng: origin.lng },
        destination: { lat: destination.lat, lng: destination.lng },
        travelMode: travel,
        provideRouteAlternatives: false,
      },
      (result, status) => {
        // Discard stale results: a newer request has been queued, only
        // the latest one is allowed to update the on-screen path.
        if (myReq !== requestIdRef.current) return;
        if (status === 'OK' && result?.routes?.[0]) {
          const r = result.routes[0];
          // `overview_path` is already road-following; for a smoother line
          // we concatenate every step's path, which retains all the small
          // turns that the overview can flatten on long routes.
          const stepPaths = (r.legs || []).flatMap((leg) =>
            (leg.steps || []).flatMap((step) =>
              (step.path || []).map((p) => ({ lat: p.lat(), lng: p.lng() })),
            ),
          );
          const overviewPath = (r.overview_path || []).map((p) => ({
            lat: p.lat(),
            lng: p.lng(),
          }));
          const path = stepPaths.length > 1 ? stepPaths : overviewPath;
          const leg = r.legs?.[0];
          if (path.length > 1) hasPathRef.current = true;
          setRoute({
            path: path.length > 1 ? path : null,
            distanceMeters: leg?.distance?.value ?? null,
            durationSeconds: leg?.duration?.value ?? null,
            status: 'ok',
          });
        } else {
          // Keep the last good path so the line doesn't flicker when a
          // single request fails (e.g. transient OVER_QUERY_LIMIT).
          setRoute((prev) => ({ ...prev, status: status || 'error' }));
        }
      },
    );

    // No cleanup: in-flight requests are allowed to complete. Staleness
    // is handled by the request-id check inside the callback. Cancelling
    // here would re-introduce the GPS-jitter race that produced the
    // "fallback line never replaced" symptom on the driver side.
    return undefined;
  }, [maps, origin, destination, travelMode, enabled]);

  return route;
}

export default useDirectionsRoute;
