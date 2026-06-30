import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { OTP } from '../models/otp.model.js';
import { Driver } from '../models/driverModels/driver.model.js';
import Booking from '../models/booking.model.js';
import Zone from '../models/zone.model.js';
import { ApiError } from '../utils/apiError.js';
import { sendSmsOtp } from '../utils/otpService.js';
import { ACTIVE_BOOKING_STATUSES } from '../constants/bookingStatus.js';
import {
  generateAccessToken,
  generateRefreshToken,
  tokenPayloadFromDriver,
} from '../utils/jwt.util.js';
import { mergeDocumentsByType, dedupeDocumentsByType } from '../utils/driverDocuments.util.js';
import TrainingVideo from '../models/trainingVideo.model.js';
import {
  getActiveTrainingVideos,
  mergeTrainingProgress,
  isDriverTrainingComplete,
  isWatchComplete,
  getWatchThresholdSeconds,
} from '../utils/driverTraining.util.js';
import { syncDriverKitEligibility } from '../utils/kitEligibility.util.js';
import { DRIVER_ONBOARDING_STEP } from '../constants/driverOnboarding.js';
import {
  hasCompletedLiveVerification,
  isApplicationSubmitted,
} from '../utils/driverOnboarding.util.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../utils/cloudinary.js';

export const sendOtpService = async (phone) => {
  if (!phone || phone.length !== 10) {
    throw new ApiError(400, 'Valid 10-digit phone number required');
  }

  const existingDriver = await Driver.findOne({ phone });
  if (existingDriver) {
    throw new ApiError(400, 'Number already exists, please login');
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await OTP.findOneAndUpdate({ phone }, { otp, expiresAt }, { upsert: true, new: true });

  await sendSmsOtp(phone, otp);
  return { message: 'OTP sent successfully' };
};

export const verifyOtpAndRegisterService = async (data) => {
  const { phone, otp, name, password, referralCode } = data;

  if (!phone || !otp || !name || !password) {
    throw new ApiError(400, 'Missing required fields');
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

  let driver = await Driver.findOne({ phone });
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  if (driver) {
    driver.name = name;
    driver.password = hashedPassword;
    driver.authProvider = 'local';
    if (driver.onboardingStep < 1) driver.onboardingStep = 1;
    await driver.save();
  } else {
    const myReferralCode = (name.substring(0, 3).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase()).replace(/[^A-Z0-9]/g, '');

    driver = new Driver({
      name,
      phone,
      email: `${phone}@driver.searchmydriver.local`, // Give them an email so they don't break
      password: hashedPassword,
      authProvider: 'local',
      onboardingStep: 1,
      approvalStatus: 'pending',
      referralCode: myReferralCode,
    });
    await driver.save();

    // Handle incoming referral code
    if (referralCode) {
      const code = referralCode.trim().toUpperCase();
      let referrer = await Driver.findOne({ referralCode: code });
      let referrerType = 'Driver';

      if (!referrer) {
        // We import User dynamically to avoid circular dependencies if any
        const User = (await import('../models/user.model.js')).default;
        referrer = await User.findOne({ referralCode: code });
        referrerType = 'User';
      }

      if (referrer) {
        const PlatformSettings = (await import('../models/platformSettings.model.js')).default;
        const Referral = (await import('../models/referral.model.js')).default;
        const WalletTransaction = (await import('../models/walletTransaction.model.js')).default;

        const settings = await PlatformSettings.findOne();
        const driverSettings = settings?.referral?.driver || {};

        if (driverSettings.enabled) {
          await Referral.create({
            referrerId: referrer._id,
            referrerType,
            referredId: driver._id,
            referredType: 'Driver',
            status: 'pending',
            rewardAmount: driverSettings.rewardAmount || 0,
            signupBonusAmount: driverSettings.signupBonus || 0,
          });

          if (driverSettings.signupBonus > 0) {
            driver.wallet = {
              balance: driverSettings.signupBonus,
              totalEarnings: driverSettings.signupBonus,
              totalWithdrawn: 0
            };
            await driver.save();
            await WalletTransaction.create({
              userType: 'Driver',
              userId: driver._id,
              direction: 'credit',
              amountRupees: driverSettings.signupBonus,
              balanceAfter: driver.wallet.balance,
              source: 'signup_bonus',
              description: 'Signup bonus from referral',
              refType: 'Referral',
              refId: null,
            });
          }
        }
      }
    }
  }

  const payload = tokenPayloadFromDriver(driver);

  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
    driver: {
      id: driver._id,
      name: driver.name,
      phone: driver.phone,
      email: driver.email,
      onboardingStep: driver.onboardingStep,
      approvalStatus: driver.approvalStatus,
    },
  };
};

export const loginDriverService = async (phone, password) => {
  if (!phone || !password) {
    throw new ApiError(400, 'Phone and password required');
  }

  const driver = await Driver.findOne({ phone }).select('+password');
  if (!driver || driver.isDeleted) {
    throw new ApiError(401, 'Invalid credentials');
  }

  if (driver.authProvider === 'google') {
    throw new ApiError(401, 'This account uses Google sign-in');
  }

  const isMatch = await bcrypt.compare(password, driver.password);
  if (!isMatch) {
    throw new ApiError(401, 'Invalid credentials');
  }

  driver.password = undefined;
  const payload = tokenPayloadFromDriver(driver);

  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
    driver: {
      id: driver._id,
      name: driver.name,
      phone: driver.phone,
      email: driver.email,
      onboardingStep: driver.onboardingStep,
      approvalStatus: driver.approvalStatus,
      approvalNote: driver.approvalNote || '',
    },
  };
};

export const updateOnboardingStepService = async (driverId, data) => {
  const { stepData, stepNumber } = data;

  const driver = await Driver.findById(driverId);
  if (!driver) {
    throw new ApiError(404, 'Driver not found');
  }

  if (stepNumber === 2) {
    const {
      normalizeDriverVehicleExperience,
      syncCarTypeExperienceFromVehicles,
    } = await import('../utils/driverVehicleExperience.util.js');

    driver.drivingLicense = stepData.drivingLicense;
    driver.experienceYears = stepData.experienceYears;
    driver.availability = stepData.availability;

    if (stepData.vehicleExperience?.length) {
      const vehicles = await normalizeDriverVehicleExperience(stepData.vehicleExperience);
      driver.vehicleExperience = vehicles;
      driver.carTypeExperience = syncCarTypeExperienceFromVehicles(vehicles);
    } else if (stepData.carTypeExperience?.length) {
      driver.carTypeExperience = stepData.carTypeExperience;
    } else {
      throw new ApiError(400, 'Add at least one vehicle you have experience driving');
    }

    if (stepData.documents) mergeDocumentsByType(driver.documents, stepData.documents);
    if (driver.onboardingStep < 2) driver.onboardingStep = 2;
  } else if (stepNumber === 3) {
    driver.bankDetails = stepData.bankDetails;
    if (driver.onboardingStep < 3) driver.onboardingStep = 3;
  } else if (stepNumber === 4) {
    if (stepData.safetyDeclaration) {
      driver.safetyDeclaration = { agreed: stepData.safetyDeclaration.agreed, agreedAt: new Date() };
    }
    if (stepData.documents) mergeDocumentsByType(driver.documents, stepData.documents);
    if (driver.onboardingStep < 4) driver.onboardingStep = 4;
  } else if (stepNumber === 5) {
    // Allows skipping the live video verification
    if (driver.onboardingStep < 5) driver.onboardingStep = 5;
  } else {
    throw new ApiError(400, 'Invalid step number');
  }

  await driver.save();
  return driver;
};

const LIVE_VERIFICATION_MIN_SECONDS = 15;
const LIVE_VERIFICATION_MAX_SECONDS = 180;

export const uploadLiveVerificationService = async (driverId, file, durationSeconds) => {
  if (!file) {
    throw new ApiError(400, 'Recorded video is required');
  }

  const driver = await Driver.findById(driverId);
  if (!driver) throw new ApiError(404, 'Driver not found');

  if (isApplicationSubmitted(driver)) {
    throw new ApiError(400, 'Application already submitted');
  }

  if (driver.onboardingStep < DRIVER_ONBOARDING_STEP.SAFETY) {
    throw new ApiError(400, 'Complete safety documents before live verification');
  }

  const reportedDuration = Number(durationSeconds) || 0;
  if (reportedDuration < LIVE_VERIFICATION_MIN_SECONDS) {
    throw new ApiError(
      400,
      `Recording must be at least ${LIVE_VERIFICATION_MIN_SECONDS} seconds`,
    );
  }
  if (reportedDuration > LIVE_VERIFICATION_MAX_SECONDS) {
    throw new ApiError(400, 'Recording is too long. Please record again.');
  }

  const oldPublicId = driver.liveVerificationVideo?.cloudinaryPublicId;
  const uploadResult = await uploadToCloudinary(file.buffer, 'searchmydriver/live-verification', {
    resourceType: 'video',
  });

  if (oldPublicId) {
    await deleteFromCloudinary(oldPublicId, 'video');
  }

  const cloudDuration = Math.round(uploadResult.duration || reportedDuration);

  driver.liveVerificationVideo = {
    videoUrl: uploadResult.secure_url,
    cloudinaryPublicId: uploadResult.public_id,
    recordedAt: new Date(),
    durationSeconds: cloudDuration,
  };

  if (driver.onboardingStep < DRIVER_ONBOARDING_STEP.LIVE_VERIFICATION) {
    driver.onboardingStep = DRIVER_ONBOARDING_STEP.LIVE_VERIFICATION;
  }

  await driver.save();

  return {
    liveVerificationVideo: driver.liveVerificationVideo,
    onboardingStep: driver.onboardingStep,
  };
};

export const reopenRejectedApplicationService = async (driverId) => {
  const driver = await Driver.findById(driverId);
  if (!driver) throw new ApiError(404, 'Driver not found');

  if (driver.approvalStatus !== 'rejected') {
    throw new ApiError(400, 'Only rejected applications can be updated');
  }

  driver.approvalStatus = 'pending';
  driver.approvalNote = '';
  driver.onboardingStep = DRIVER_ONBOARDING_STEP.SAFETY;
  driver.trainingProgress = [];
  await driver.save();

  return {
    id: driver._id,
    onboardingStep: driver.onboardingStep,
    approvalStatus: driver.approvalStatus,
    liveVerificationVideo: driver.liveVerificationVideo,
  };
};

export const getDriverTrainingService = async (driverId) => {
  const driver = await Driver.findById(driverId);
  if (!driver) throw new ApiError(404, 'Driver not found');

  const videos = await getActiveTrainingVideos();
  const items = mergeTrainingProgress(videos, driver.trainingProgress);
  const requiredVideos = items.filter((v) => v.isRequired);
  const allRequiredComplete = requiredVideos.length
    ? requiredVideos.every((v) => v.completed)
    : true;

  return {
    videos: items,
    allRequiredComplete,
    canSubmit:
      hasCompletedLiveVerification(driver) &&
      driver.onboardingStep >= DRIVER_ONBOARDING_STEP.LIVE_VERIFICATION &&
      allRequiredComplete,
  };
};

export const updateTrainingProgressService = async (driverId, data) => {
  const { trainingVideoId, watchedSeconds, completed } = data;

  if (!trainingVideoId) {
    throw new ApiError(400, 'Training video ID is required');
  }

  const driver = await Driver.findById(driverId);
  if (!driver) throw new ApiError(404, 'Driver not found');

  if (!hasCompletedLiveVerification(driver)) {
    throw new ApiError(400, 'Complete live verification before training');
  }

  if (isApplicationSubmitted(driver)) {
    throw new ApiError(400, 'Application already submitted');
  }

  const video = await TrainingVideo.findOne({ _id: trainingVideoId, isActive: true });
  if (!video) throw new ApiError(404, 'Training video not found');

  const safeWatched = Math.max(0, Math.min(Number(watchedSeconds) || 0, video.durationSeconds || Number.MAX_SAFE_INTEGER));
  const markComplete = Boolean(completed);

  if (markComplete && !isWatchComplete(safeWatched, video.durationSeconds)) {
    throw new ApiError(
      400,
      `Please watch at least ${getWatchThresholdSeconds(video.durationSeconds)} seconds before completing this video`,
    );
  }

  const progressIndex = driver.trainingProgress.findIndex(
    (p) => String(p.trainingVideoId) === String(trainingVideoId),
  );

  const entry = {
    trainingVideoId: video._id,
    watchedSeconds: safeWatched,
    completed: markComplete,
    completedAt: markComplete ? new Date() : null,
  };

  if (progressIndex >= 0) {
    if (driver.trainingProgress[progressIndex].completed) {
      entry.completed = true;
      entry.completedAt = driver.trainingProgress[progressIndex].completedAt || new Date();
    }
    driver.trainingProgress[progressIndex] = entry;
  } else {
    driver.trainingProgress.push(entry);
  }

  await driver.save();

  const merged = mergeTrainingProgress([video.toObject()], driver.trainingProgress)[0];
  return merged;
};

export const submitApplicationService = async (driverId) => {
  const driver = await Driver.findById(driverId);
  if (!driver) {
    throw new ApiError(404, 'Driver not found');
  }

  if (!hasCompletedLiveVerification(driver)) {
    throw new ApiError(400, 'Please complete live identity verification first');
  }

  if (driver.onboardingStep < DRIVER_ONBOARDING_STEP.LIVE_VERIFICATION) {
    throw new ApiError(400, 'Please complete all onboarding steps before submitting');
  }

  if (!driver.safetyDeclaration?.agreed) {
    throw new ApiError(400, 'Please complete the safety declaration first');
  }

  // Training validation removed as per user request to make videos non-mandatory
  // const trainingComplete = await isDriverTrainingComplete(driver);
  // if (!trainingComplete) {
  //   throw new ApiError(400, 'Please complete all required training videos before submitting');
  // }

  driver.approvalStatus = 'under_review';
  driver.onboardingStep = DRIVER_ONBOARDING_STEP.SUBMITTED;
  await driver.save();

  const { upsertDriverReviewTask } = await import('./adminTask.service.js');
  await upsertDriverReviewTask(driver);

  return driver;
};

const vehicleExperiencePopulate = [
  { path: 'vehicleExperience.carTypeId', select: 'name' },
  { path: 'vehicleExperience.brandId', select: 'name' },
  { path: 'vehicleExperience.modelId', select: 'name' },
  { path: 'vehicleExperience.fuelTypeId', select: 'name' },
  { path: 'carTypeExperience', select: 'name' },
  { path: 'preferredOutstationZones', select: 'name code city isActive' },
];

export const getProfileService = async (driverId) => {
  const driver = await Driver.findById(driverId).populate(vehicleExperiencePopulate);
  if (!driver) {
    throw new ApiError(404, 'Driver not found');
  }

  if (!driver.referralCode) {
    driver.referralCode = 'DRV' + Math.random().toString(36).substring(2, 8).toUpperCase();
    await Driver.findByIdAndUpdate(driverId, { referralCode: driver.referralCode });
  }
  driver.documents = dedupeDocumentsByType(driver.documents);

  const eligibility = await syncDriverKitEligibility(driverId);

  const doc = driver.toObject();
  doc.kitEligibility = {
    canGoOnline: eligibility.allowed,
    reasons: eligibility.reasons,
    code: eligibility.code,
  };
  return doc;
};

/**
 * Driver-side toggle for "I can take outstation (round-trip) bookings".
 *
 * Outstation rides are manually dispatched from the admin queue (see
 * `bookingOutstationAssignment.service.js`). The picker only lists
 * drivers with `availableForOutstation === true`, so flipping this
 * flag off means the driver won't appear in the queue at all —
 * useful for drivers who only want short local hourly trips, or who
 * are unavailable for multi-day trips this week.
 *
 * `zoneIds` is the driver's preferred set of pickup zones for
 * outstation. When toggling availability ON, at least one valid
 * active zone is required — the driver UI enforces this with a
 * picker sheet, but we re-validate here because a stale FE could
 * always submit `available: true` with an empty array. When
 * toggling OFF we keep the previously chosen zones intact so the
 * driver doesn't have to re-pick them next time.
 *
 * Returns the same shape `getProfileService` returns so the caller
 * can hand the result straight back to the FE store.
 */
export const updateOutstationAvailabilityService = async (
  driverId,
  { available, zoneIds },
) => {
  const next = !!available;
  const update = {
    availableForOutstation: next,
    outstationAvailabilityUpdatedAt: new Date(),
  };

  // Resolve the zone list we should persist. Caller-supplied wins;
  // otherwise fall back to whatever is already on the driver. We
  // only validate / persist zones when turning availability ON.
  if (next) {
    let resolvedZoneIds = null;
    if (Array.isArray(zoneIds)) {
      const seen = new Set();
      const cleaned = [];
      for (const raw of zoneIds) {
        const id = String(raw || '').trim();
        if (!id || seen.has(id)) continue;
        if (!mongoose.Types.ObjectId.isValid(id)) continue;
        seen.add(id);
        cleaned.push(new mongoose.Types.ObjectId(id));
      }
      resolvedZoneIds = cleaned;
    }

    if (resolvedZoneIds === null) {
      // Caller didn't pass zones — reuse what's already saved.
      const existing = await Driver.findById(driverId)
        .select('preferredOutstationZones')
        .lean();
      resolvedZoneIds = (existing?.preferredOutstationZones || []).map(
        (id) => new mongoose.Types.ObjectId(String(id)),
      );
    }

    if (!resolvedZoneIds.length) {
      throw new ApiError(
        400,
        'Pick at least one preferred outstation zone before turning this on.',
      );
    }

    // Verify the zones exist and are active. We don't want a driver
    // pinned to an archived zone that admins are no longer dispatching.
    const activeZones = await Zone.find({
      _id: { $in: resolvedZoneIds },
      isActive: true,
    })
      .select('_id')
      .lean();
    if (activeZones.length !== resolvedZoneIds.length) {
      throw new ApiError(
        400,
        'One or more selected zones are no longer available. Refresh and try again.',
      );
    }

    update.preferredOutstationZones = resolvedZoneIds;
  }

  const driver = await Driver.findByIdAndUpdate(
    driverId,
    { $set: update },
    { new: true },
  ).populate(vehicleExperiencePopulate);
  if (!driver) {
    throw new ApiError(404, 'Driver not found');
  }
  driver.documents = dedupeDocumentsByType(driver.documents);
  return driver.toObject();
};

/**
 * Driver-side toggle for "I can take monthly bookings".
 */
export const updateMonthlyAvailabilityService = async (driverId, { available }) => {
  const next = !!available;
  const update = {
    availableForMonthlyRide: next,
  };

  const driver = await Driver.findByIdAndUpdate(
    driverId,
    { $set: update },
    { new: true },
  ).populate(vehicleExperiencePopulate);

  if (!driver) {
    throw new ApiError(404, 'Driver not found');
  }

  driver.documents = dedupeDocumentsByType(driver.documents);
  return driver.toObject();
};

export const deleteDriverAccountService = async (driverId) => {
  const driver = await Driver.findById(driverId);
  if (!driver || driver.isDeleted) {
    throw new ApiError(404, 'Driver not found');
  }

  const activeBookings = await Booking.countDocuments({
    driverId,
    isDeleted: false,
    status: { $in: ACTIVE_BOOKING_STATUSES },
  });

  if (activeBookings > 0) {
    throw new ApiError(409, 'Finish or cancel your active trips before deleting your account');
  }

  driver.isDeleted = true;
  driver.deletedAt = new Date();
  driver.isOnline = false;
  driver.isOnTrip = false;
  driver.currentBookingId = null;
  driver.socketId = null;
  driver.fcmToken = '';
  driver.canGoOnline = false;
  driver.availableForOutstation = false;
  driver.availableForMonthlyRide = false;
  driver.preferredOutstationZones = [];
  await driver.save();

  return {
    id: driver._id,
    deletedAt: driver.deletedAt,
  };
};
