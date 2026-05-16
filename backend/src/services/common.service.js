import { uploadToCloudinary, deleteFromCloudinary } from '../utils/cloudinary.js';
import { ApiError } from '../utils/apiError.js';
import { Driver } from '../models/driverModels/driver.model.js';
import User from '../models/user.model.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  tokenPayloadFromUser,
  tokenPayloadFromDriver,
  inferAccountType,
} from '../utils/jwt.util.js';
import { ACCOUNT_DRIVER } from '../constants/roles.js';

export const uploadImageService = async (file, oldPublicId) => {
  if (!file) {
    throw new ApiError(400, 'No file provided');
  }

  const result = await uploadToCloudinary(file.buffer, 'sparedriver/documents');

  if (oldPublicId) {
    await deleteFromCloudinary(oldPublicId);
  }

  return {
    url: result.secure_url,
    publicId: result.public_id,
  };
};

/**
 * Validates refresh token, loads principal, returns new token pair payload.
 * @param {string} incomingRefreshToken
 */
export const refreshSessionTokens = async (incomingRefreshToken) => {
  if (!incomingRefreshToken) {
    throw new ApiError(401, 'Unauthorized request');
  }

  const decoded = verifyRefreshToken(incomingRefreshToken);
  const accountType = inferAccountType(decoded);

  let principal;
  let jwtPayload;

  if (accountType === ACCOUNT_DRIVER) {
    principal = await Driver.findById(decoded.id);
    if (!principal || principal.isDeleted) throw new ApiError(401, 'Invalid refresh token');
    jwtPayload = tokenPayloadFromDriver(principal);
  } else {
    principal = await User.findById(decoded.id);
    if (!principal || principal.isDeleted) throw new ApiError(401, 'Invalid refresh token');
    jwtPayload = tokenPayloadFromUser(principal);
  }

  return {
    accessToken: generateAccessToken(jwtPayload),
    refreshToken: generateRefreshToken(jwtPayload),
  };
};
