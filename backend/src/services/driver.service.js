import bcrypt from 'bcrypt';
import { OTP } from '../models/otp.model.js';
import { Driver } from '../models/driverModels/driver.model.js';
import { ApiError } from '../utils/apiError.js';
import { sendSmsOtp } from '../utils/otpService.js';
import {
  generateAccessToken,
  generateRefreshToken,
  tokenPayloadFromDriver,
} from '../utils/jwt.util.js';
import { mergeDocumentsByType, dedupeDocumentsByType } from '../utils/driverDocuments.util.js';

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
  const { phone, otp, name, email, password } = data;

  if (!phone || !otp || !name || !password) {
    throw new ApiError(400, 'Missing required fields');
  }

  const otpRecord = await OTP.findOne({ phone, otp });
  if (!otpRecord) {
    throw new ApiError(400, 'Invalid or expired OTP');
  }

  await OTP.deleteOne({ _id: otpRecord._id });

  let driver = await Driver.findOne({ phone });
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  if (driver) {
    driver.name = name;
    driver.email = email;
    driver.password = hashedPassword;
    if (driver.onboardingStep < 1) driver.onboardingStep = 1;
    await driver.save();
  } else {
    driver = new Driver({
      name,
      phone,
      email,
      password: hashedPassword,
      onboardingStep: 1,
      approvalStatus: 'pending',
    });
    await driver.save();
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
    driver.drivingLicense = stepData.drivingLicense;
    driver.experienceYears = stepData.experienceYears;
    driver.availability = stepData.availability;
    driver.carTypeExperience = stepData.carTypeExperience;
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
  } else {
    throw new ApiError(400, 'Invalid step number');
  }

  await driver.save();
  return driver;
};

export const submitApplicationService = async (driverId) => {
  const driver = await Driver.findById(driverId);
  if (!driver) {
    throw new ApiError(404, 'Driver not found');
  }

  if (driver.onboardingStep < 4) {
    throw new ApiError(400, 'Please complete all steps before submitting');
  }

  driver.approvalStatus = 'under_review';
  driver.onboardingStep = 5;
  await driver.save();
  return driver;
};

export const getProfileService = async (driverId) => {
  const driver = await Driver.findById(driverId);
  if (!driver) {
    throw new ApiError(404, 'Driver not found');
  }
  driver.documents = dedupeDocumentsByType(driver.documents);
  return driver;
};
