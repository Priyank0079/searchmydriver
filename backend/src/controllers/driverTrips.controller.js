import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/apiResponse.js';
import {
  getDriverHomeSummaryService,
  getDriverTripsListService,
  getDriverEarningsService,
  listDriverEarningsLedgerService,
} from '../services/driverTrips.service.js';

export const getDriverHomeSummary = asyncHandler(async (req, res) => {
  const summary = await getDriverHomeSummaryService(req.driver._id);
  return res.status(200).json(new ApiResponse(200, summary, 'Driver home summary'));
});

export const getDriverTripsList = asyncHandler(async (req, res) => {
  const result = await getDriverTripsListService(req.driver._id, req.query);
  return res.status(200).json(new ApiResponse(200, result, 'Driver trips fetched'));
});

export const getDriverEarnings = asyncHandler(async (req, res) => {
  const result = await getDriverEarningsService(req.driver._id);
  return res.status(200).json(new ApiResponse(200, result, 'Driver earnings fetched'));
});

export const getDriverEarningsLedger = asyncHandler(async (req, res) => {
  const result = await listDriverEarningsLedgerService(req.driver._id, {
    page: req.query.page,
    limit: req.query.limit,
  });
  return res
    .status(200)
    .json(new ApiResponse(200, result, 'Driver earnings ledger fetched'));
});
