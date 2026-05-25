import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/apiResponse.js';
import * as zoneService from '../services/zone.service.js';

export const createZone = asyncHandler(async (req, res) => {
  const result = await zoneService.createZoneService(req.staff._id, req.body);
  return res.status(201).json(new ApiResponse(201, result, 'Zone created successfully'));
});

export const listZones = asyncHandler(async (req, res) => {
  const result = await zoneService.listZonesService(req.query);
  return res.status(200).json(new ApiResponse(200, result, 'Zones fetched'));
});

export const getZoneById = asyncHandler(async (req, res) => {
  const result = await zoneService.getZoneByIdService(req.params.id);
  return res.status(200).json(new ApiResponse(200, result, 'Zone fetched'));
});

export const updateZone = asyncHandler(async (req, res) => {
  const result = await zoneService.updateZoneService(req.params.id, req.body);
  return res.status(200).json(new ApiResponse(200, result, 'Zone updated successfully'));
});

export const deleteZone = asyncHandler(async (req, res) => {
  const result = await zoneService.deleteZoneService(req.params.id);
  return res.status(200).json(new ApiResponse(200, result, 'Zone deleted'));
});

/** Public / driver — active zones for matching (future dispatch) */
export const listActiveZones = asyncHandler(async (req, res) => {
  const result = await zoneService.listZonesService({ activeOnly: true });
  return res.status(200).json(new ApiResponse(200, result, 'Active zones fetched'));
});

/**
 * GET /common/zones/check?lat=&lng=
 *
 * "Do we operate at this point?" — used by the user app to gate a booking
 * the moment the user picks a pickup location. Returns `{ inZone, zone }`
 * where `zone` is the matching active zone (id + name + city) when there
 * is one, or `null` otherwise.
 */
export const checkZoneForPoint = asyncHandler(async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const zone = await zoneService.findActiveZoneForPointService({ lat, lng });
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        inZone: Boolean(zone),
        zone: zone
          ? {
              _id: zone._id,
              name: zone.name,
              city: zone.city,
              radiusKm: zone.radiusKm,
              shapeType: zone.shapeType,
            }
          : null,
      },
      zone ? 'Inside a service zone' : 'Outside our service area',
    ),
  );
});
