import { Driver } from '../models/driverModels/driver.model.js';
import User from '../models/user.model.js';
import Car from '../models/user/car.model.js';
import bcrypt from 'bcrypt';
import { ApiError } from '../utils/apiError.js';
import { USER_ROLES, STAFF_ROLES } from '../constants/roles.js';
import { dedupeDocumentsByType } from '../utils/driverDocuments.util.js';
import {
  getActiveTrainingVideos,
  mergeTrainingProgress,
  isDriverTrainingComplete,
} from '../utils/driverTraining.util.js';
import {
  generateAccessToken,
  generateRefreshToken,
  tokenPayloadFromUser,
} from '../utils/jwt.util.js';

export const loginStaffService = async (email, password) => {
  if (!email || !password) {
    throw new ApiError(400, 'Email and password required');
  }
  console.log("email and password is ", email, password);
  const staff = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!staff || !STAFF_ROLES.includes(staff.role)) {
    throw new ApiError(401, 'Invalid credentials or unauthorized');
  }

  if (!staff.isActive) {
    throw new ApiError(403, 'Your account has been deactivated. Please contact the administrator.');
  }

  const isMatch = await bcrypt.compare(password, staff.password);
  if (!isMatch) {
    console.log("password did not match");
    throw new ApiError(401, 'Invalid credentials');
  }

  staff.password = undefined;
  const payload = tokenPayloadFromUser(staff);

  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
    admin: staff,
  };
};

export const getCustomersService = async (query) => {
  const { search, page = 1, limit = 10 } = query;

  const filter = { role: USER_ROLES.USER, isDeleted: false };
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phone_no: { $regex: search, $options: 'i' } },
    ];
  }

  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const total = await User.countDocuments(filter);
  const users = await User.find(filter)
    .select('-password')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit, 10));

  const userIds = users.map((u) => u._id);
  const carCounts = userIds.length
    ? await Car.aggregate([
        { $match: { userId: { $in: userIds }, isActive: true } },
        { $group: { _id: '$userId', count: { $sum: 1 } } },
      ])
    : [];

  const countMap = new Map(carCounts.map((c) => [String(c._id), c.count]));

  const data = users.map((u) => {
    const doc = u.toObject();
    doc.carsCount = countMap.get(String(u._id)) || 0;
    return doc;
  });

  return {
    data,
    pagination: {
      total,
      page: parseInt(page, 10),
      pages: Math.ceil(total / parseInt(limit, 10)) || 1,
    },
  };
};

export const getDriversService = async (query) => {
  const { status, search, page = 1, limit = 10 } = query;

  const filter = {};
  if (status) filter.approvalStatus = status;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } }
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const total = await Driver.countDocuments(filter);
  const data = await Driver.find(filter)
    .populate('carTypeExperience', 'name')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const normalized = data.map((driver) => {
    const doc = driver.toObject();
    doc.documents = dedupeDocumentsByType(doc.documents);
    return doc;
  });

  return {
    data: normalized,
    pagination: {
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit))
    }
  };
};

export const getDriverByIdService = async (driverId) => {
  const driver = await Driver.findById(driverId)
    .populate('carTypeExperience', 'name image')
    .populate('approvedBy', 'name email');

  if (!driver) {
    throw new ApiError(404, 'Driver not found');
  }

  const doc = driver.toObject();
  doc.documents = dedupeDocumentsByType(doc.documents);

  const videos = await getActiveTrainingVideos();
  const training = mergeTrainingProgress(videos, doc.trainingProgress);
  const trainingComplete = await isDriverTrainingComplete(driver);

  return {
    driver: doc,
    training,
    trainingComplete,
  };
};

export const updateDriverStatusService = async (adminId, driverId, data) => {
  const { approvalStatus, approvalNote } = data;

  if (!['approved', 'rejected', 'suspended'].includes(approvalStatus)) {
    throw new ApiError(400, 'Invalid status');
  }

  const note = (approvalNote || '').trim();
  if (['approved', 'rejected'].includes(approvalStatus) && note.length < 10) {
    throw new ApiError(400, 'Approval note is required (minimum 10 characters) for approve or reject actions');
  }

  const driver = await Driver.findById(driverId);
  if (!driver) {
    throw new ApiError(404, 'Driver not found');
  }

  driver.approvalStatus = approvalStatus;
  driver.approvalNote = note;

  if (approvalStatus === 'approved') {
    driver.approvedAt = new Date();
    driver.approvedBy = adminId;
  } else if (approvalStatus === 'rejected') {
    driver.approvedAt = null;
    driver.approvedBy = adminId; // Track who rejected it too
  } else {
    driver.approvedAt = null;
    driver.approvedBy = null;
  }

  await driver.save();
  return driver;
};

export const addAdminMemberService = async (data) => {
  const { name, email, phone_no, password } = data;

  if (!name || !email || !phone_no || !password) {
    throw new ApiError(400, 'Missing required fields');
  }

  const adminExists = await User.findOne({ email });
  if (adminExists) {
    throw new ApiError(400, 'Admin with this email already exists');
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const newAdmin = new User({
    name,
    email,
    phone_no,
    password: hashedPassword,
    role: USER_ROLES.TEAM_MEMBER,
  });

  await newAdmin.save();
  newAdmin.password = undefined;
  return newAdmin;
};

export const getAdminTeamService = async (query) => {
  const { search, page = 1, limit = 10 } = query;
  
  const filter = {
    role: { $in: [USER_ROLES.ADMIN, USER_ROLES.TEAM_MEMBER] }
  };

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  const total = await User.countDocuments(filter);
  const data = await User.find(filter)
    .select('-password')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  return {
    data,
    pagination: {
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit))
    }
  };
};

export const updateAdminMemberService = async (id, data) => {
  const { name, email, phone_no, role, isActive } = data;
  const staff = await User.findById(id);
  
  if (!staff || !STAFF_ROLES.includes(staff.role)) {
    throw new ApiError(404, 'Staff member not found');
  }

  if (name) staff.name = name;
  if (email) staff.email = email;
  if (phone_no) staff.phone_no = phone_no;
  if (role && STAFF_ROLES.includes(role)) staff.role = role;
  if (isActive !== undefined) staff.isActive = isActive;

  await staff.save();
  staff.password = undefined;
  return staff;
};

export const deleteAdminMemberService = async (id) => {
  const staff = await User.findById(id);
  if (!staff || !STAFF_ROLES.includes(staff.role)) {
    throw new ApiError(404, 'Staff member not found');
  }

  // Hard delete as per user request
  await User.findByIdAndDelete(id);
  return { id };
};
