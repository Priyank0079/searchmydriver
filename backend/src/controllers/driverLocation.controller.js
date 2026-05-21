import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/apiResponse.js';
import {
  listOnlineDriversSnapshot,
  isLiveLocationReady,
} from '../services/driverLocation.service.js';

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
