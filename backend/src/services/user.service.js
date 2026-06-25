import bcrypt from 'bcryptjs';
import User from '../models/user.model.js';
import { ApiError } from '../utils/apiError.js';
import {
  generateAccessToken,
  generateRefreshToken,
  tokenPayloadFromUser,
} from '../utils/jwt.util.js';
import { USER_ROLES } from '../constants/roles.js';

function sanitizeUser(doc) {
  const o = doc.toObject();
  delete o.password;
  o.needsPhone = !o.phone_no || !o.isPhoneVerified;
  return o;
}

import { OTP } from '../models/otp.model.js';
import { sendSmsOtp } from '../utils/otpService.js';

export const sendUserOtpService = async (phone) => {
  if (!phone || phone.length !== 10) {
    throw new ApiError(400, 'Valid 10-digit phone number required');
  }

  const existingUser = await User.findOne({ phone_no: phone });
  if (existingUser) {
    throw new ApiError(400, 'Number already exists, please login');
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await OTP.findOneAndUpdate({ phone }, { otp, expiresAt }, { upsert: true, new: true });

  await sendSmsOtp(phone, otp);
  return { message: 'OTP sent successfully' };
};

export const verifyUserOtpAndRegisterService = async ({ name, phone, password, otp }) => {
  if (!name || !phone || !password || !otp) {
    throw new ApiError(400, 'All fields are required');
  }

  // Development bypass: allow '123456' locally so you don't need a real SMS gateway to test
  if (process.env.NODE_ENV !== 'production' && otp === '123456') {
    // skip DB check
  } else {
    const otpRecord = await OTP.findOne({ phone, otp });
    if (!otpRecord) {
      throw new ApiError(400, 'Invalid or expired OTP');
    }
    await OTP.deleteOne({ _id: otpRecord._id });
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const user = await User.create({
    name,
    email: `${phone}@phone.sparedriver.local`,
    phone_no: phone,
    password: hashedPassword,
    role: USER_ROLES.USER,
    authProvider: 'local',
    isPhoneVerified: true,
  });

  const payload = tokenPayloadFromUser(user);
  return {
    user: sanitizeUser(user),
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
  };
};

export const loginUserService = async (phone, password) => {
  if (!phone || !password) {
    throw new ApiError(400, 'Phone and password required');
  }

  const user = await User.findOne({ phone_no: phone }).select('+password');
  if (!user || user.isDeleted) {
    throw new ApiError(401, 'Invalid credentials');
  }

  if (user.role !== USER_ROLES.USER) {
    throw new ApiError(401, 'Use the correct sign-in page for your account type');
  }

  if (user.authProvider === 'google') {
    throw new ApiError(401, 'This account uses Google sign-in');
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new ApiError(401, 'Invalid credentials');
  }

  const safeUser = await User.findById(user._id).select('-password');
  const payload = tokenPayloadFromUser(safeUser);
  return {
    user: sanitizeUser(safeUser),
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
  };
};

import Car from '../models/user/car.model.js';
import PlatformCondition from '../models/platformCondition.model.js';
import { validateCarCatalogRefs } from './vehicleCatalog.service.js';

// ... (existing sanitize, etc.)

// ─── User Onboarding & Vehicle Services ──────────────────────────────────────

/** All active required platform conditions must be accepted (true). Handles new admin-added items. */
async function isChecklistComplete(user) {
  const activeConditions = await PlatformCondition.find({ isActive: true }).lean();
  if (!activeConditions.length) return true;

  const answerMap = new Map(
    (user.conditions || []).map((c) => [String(c.conditionId), c.value]),
  );

  const required = activeConditions.filter((c) => c.isRequired);
  if (!required.length) return true;

  return required.every((c) => answerMap.get(String(c._id)) === true);
}

export const getUserProfileService = async (userId) => {
  const user = await User.findById(userId).populate('conditions.conditionId');
  if (!user || user.isDeleted || user.role !== USER_ROLES.USER) {
    throw new ApiError(404, 'User not found');
  }

  const cars = await Car.find({ userId, isActive: true })
    .populate('carTypeId', 'name')
    .populate('brandId', 'name')
    .populate('modelId', 'name')
    .populate('fuelTypeId', 'name')
    .sort({ createdAt: -1 })
    .lean();

  const activeConditions = await PlatformCondition.find({ isActive: true }).lean();
  const answerMap = new Map(
    (user.conditions || []).map((c) => [String(c.conditionId?._id ?? c.conditionId), c.value]),
  );

  const checklist = activeConditions.map((c) => ({
    _id: c._id,
    question: c.question,
    isRequired: c.isRequired,
    value: answerMap.get(String(c._id)) ?? null,
  }));

  return {
    user: sanitizeUser(user),
    cars,
    carsCount: cars.length,
    hasChecklist: await isChecklistComplete(user),
    checklist,
  };
};

export const getRegistrationStatusService = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'User not found');

  const cars = await Car.find({ userId, isActive: true });
  const carCount = cars.length;

  return {
    hasCar: carCount > 0,
    hasChecklist: await isChecklistComplete(user),
    carCount,
    needsPhone: !user.phone_no || !user.isPhoneVerified,
    user: sanitizeUser(user),
  };
};

export const updateUserOnboardingStepService = async (userId, data) => {
  const { stepData } = data;
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'User not found');

  if (stepData.conditions) {
    const activeConditions = await PlatformCondition.find({ isActive: true }).lean();
    const payloadMap = new Map(
      stepData.conditions.map((c) => [String(c.conditionId), c.value]),
    );

    const missingRequired = activeConditions
      .filter((c) => c.isRequired)
      .filter((c) => payloadMap.get(String(c._id)) !== true);

    if (missingRequired.length) {
      throw new ApiError(400, 'Please accept all required checklist items to continue');
    }

    const merged = new Map(
      (user.conditions || []).map((c) => [
        String(c.conditionId),
        { conditionId: c.conditionId, value: c.value },
      ]),
    );

    for (const item of stepData.conditions) {
      merged.set(String(item.conditionId), {
        conditionId: item.conditionId,
        value: item.value,
      });
    }

    user.conditions = Array.from(merged.values());
  }

  await user.save();
  return sanitizeUser(user);
};

export const addCarService = async (userId, carData) => {
  const { carTypeId, brandId, modelId, modelName, fuelTypeId, vehicleNumber, transmission, image } =
    carData;

  if (!carTypeId || (!modelId && !modelName) || !vehicleNumber || !transmission) {
    throw new ApiError(400, 'Car category, model name, vehicle number, and transmission are required');
  }

  const refsToValidate = { carTypeId };
  if (brandId) refsToValidate.brandId = brandId;
  if (modelId) refsToValidate.modelId = modelId;
  if (fuelTypeId) refsToValidate.fuelTypeId = fuelTypeId;

  await validateCarCatalogRefs(refsToValidate);

  const existingCount = await Car.countDocuments({ userId, isActive: true });
  if (existingCount >= 5) {
    throw new ApiError(400, 'You can only register up to 5 vehicles');
  }

  const exists = await Car.findOne({ vehicleNumber: vehicleNumber.toUpperCase(), isActive: true });
  if (exists) {
    throw new ApiError(400, 'This vehicle number is already registered');
  }

  const car = await Car.create({
    userId,
    carTypeId,
    brandId: brandId || null,
    modelId: modelId || null,
    modelName: modelName || null,
    fuelTypeId: fuelTypeId || null,
    vehicleNumber: vehicleNumber.toUpperCase(),
    transmission: String(transmission).toLowerCase(),
    image: image || '',
  });

  const populated = await Car.findById(car._id)
    .populate('carTypeId', 'name')
    .populate('brandId', 'name')
    .populate('modelId', 'name')
    .populate('fuelTypeId', 'name');

  const carCount = await Car.countDocuments({ userId, isActive: true });
  return { car: populated, carCount };
};

export const getUserCarsService = async (userId) => {
  return Car.find({ userId, isActive: true })
    .populate('carTypeId', 'name')
    .populate('brandId', 'name')
    .populate('modelId', 'name')
    .populate('fuelTypeId', 'name')
    .sort({ createdAt: -1 })
    .lean();
};

export const deleteUserCarService = async (userId, carId) => {
  const car = await Car.findOne({ _id: carId, userId });
  if (!car) throw new ApiError(404, 'Car not found');

  car.isActive = false;
  await car.save();
  return { id: carId };
};

// ─── Saved (favourite) locations ─────────────────────────────────────────────

const MAX_SAVED_LOCATIONS = 20;

function normalizeSavedLocationInput(payload = {}) {
  const lat = Number(payload.lat);
  const lng = Number(payload.lng);
  const address = typeof payload.address === 'string' ? payload.address.trim() : '';
  const label = typeof payload.label === 'string' ? payload.label.trim().slice(0, 60) : '';
  const city = typeof payload.city === 'string' ? payload.city.trim().slice(0, 120) : '';

  if (!address) throw new ApiError(400, 'Address is required');
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new ApiError(400, 'Invalid latitude');
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) throw new ApiError(400, 'Invalid longitude');

  return { label, address: address.slice(0, 300), city, lat, lng };
}

export const listSavedLocationsService = async (userId) => {
  const user = await User.findById(userId).select('savedLocations');
  if (!user) throw new ApiError(404, 'User not found');
  // Newest first
  return [...(user.savedLocations || [])].sort(
    (a, b) => (b.createdAt?.getTime?.() || 0) - (a.createdAt?.getTime?.() || 0),
  );
};

export const addSavedLocationService = async (userId, payload) => {
  const next = normalizeSavedLocationInput(payload);

  const user = await User.findById(userId).select('savedLocations');
  if (!user) throw new ApiError(404, 'User not found');

  if ((user.savedLocations?.length || 0) >= MAX_SAVED_LOCATIONS) {
    throw new ApiError(400, `You can save up to ${MAX_SAVED_LOCATIONS} favourite locations`);
  }

  // De-dup on coords + label (rounded ~10m) so accidental double-taps don't
  // pile up identical entries.
  const dupe = (user.savedLocations || []).find(
    (loc) =>
      loc.label?.toLowerCase() === next.label.toLowerCase() &&
      Math.abs(loc.lat - next.lat) < 0.0001 &&
      Math.abs(loc.lng - next.lng) < 0.0001,
  );
  if (dupe) return dupe;

  user.savedLocations.push(next);
  await user.save();
  return user.savedLocations[user.savedLocations.length - 1];
};

export const deleteSavedLocationService = async (userId, locationId) => {
  const user = await User.findById(userId).select('savedLocations');
  if (!user) throw new ApiError(404, 'User not found');

  const before = user.savedLocations?.length || 0;
  user.savedLocations = (user.savedLocations || []).filter(
    (loc) => String(loc._id) !== String(locationId),
  );
  if (user.savedLocations.length === before) {
    throw new ApiError(404, 'Saved location not found');
  }
  await user.save();
  return { id: locationId };
};
