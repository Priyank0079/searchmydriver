import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { ApiError } from '../utils/apiError.js';
import {
  listOnlineDriversSnapshot,
  isLiveLocationReady,
} from '../services/driverLocation.service.js';
import { findDriversWithinRadius } from '../services/driverFinder.service.js';
import { NEARBY_DRIVERS } from '../constants/bookingStatus.js';

/**
 * GET /admin/drivers/live
 *
 * Returns a snapshot of currently-online drivers from Mongo. The admin live-map
 * uses this to seed initial markers BEFORE subscribing to Firebase for live
 * deltas. Without this seed the page would be blank until each driver next
 * emits a GPS update (could be several seconds).
 *
 * Mongo coords may be up to 60s stale — that's the snapshot interval. Firebase
 * subscription will overwrite them within seconds for any driver actively
 * moving.
 */
export const getLiveDriversSnapshot = asyncHandler(async (_req, res) => {
  const drivers = await listOnlineDriversSnapshot();

  const items = drivers.map((d) => {
    const [lng = 0, lat = 0] = d.location?.coordinates || [];
    return {
      _id: String(d._id),
      name: d.name,
      phone: d.phone,
      rating: d.rating,
      isOnTrip: d.isOnTrip,
      lat,
      lng,
      lastLocationAt: d.lastLocationAt,
    };
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        items,
        liveLocationReady: isLiveLocationReady(),
      },
      'Live driver snapshot',
    ),
  );
});

/**
 * GET /auth/drivers/nearby?lat=&lng=&radius=&limit=&carTypeId=
 *
 * Returns online, approved drivers near the user, sorted by distance. Powers
 * the "drivers near you" widget on the home screen and any other surface
 * that needs ad-hoc nearby-driver data. The booking dispatcher does NOT
 * call this endpoint — it talks to `driverFinder.service` directly so it
 * can use the expanding-radius variant.
 */
export const getNearbyDriversForUser = asyncHandler(async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new ApiError(400, 'lat and lng query params are required');
  }

  const radiusMeters = Math.min(
    Number(req.query.radius) || NEARBY_DRIVERS.DEFAULT_RADIUS_METERS,
    NEARBY_DRIVERS.MAX_RADIUS_METERS,
  );
  const limit = Math.min(
    Number(req.query.limit) || NEARBY_DRIVERS.DEFAULT_LIMIT,
    NEARBY_DRIVERS.MAX_LIMIT,
  );

  const carTypeIds = req.query.carTypeId
    ? String(req.query.carTypeId).split(',').filter(Boolean)
    : undefined;

  const drivers = await findDriversWithinRadius({
    lat,
    lng,
    radiusMeters,
    limit,
    carTypeIds,
    includeOnTrip: false,
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        drivers,
        radiusMeters,
        liveLocationReady: isLiveLocationReady(),
        center: { lat, lng },
      },
      'Nearby drivers fetched',
    ),
  );
});
