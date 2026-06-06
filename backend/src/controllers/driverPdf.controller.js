import { asyncHandler } from '../utils/asyncHandler.js';
import { buildDriverProfilePdf } from '../services/driverPdf.service.js';

/**
 * Stream a one-click PDF dossier for a driver.
 *
 * The service is responsible for setting the response headers and
 * piping the PDF stream into `res`; this controller just hands the
 * `res` object over and lets the service complete the response.
 */
export const downloadDriverProfilePdf = asyncHandler(async (req, res) => {
  await buildDriverProfilePdf(req.params.id, { res });
});
