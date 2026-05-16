import { Driver } from '../models/driverModels/driver.model.js';
import User from '../models/user.model.js';
import { verifyAccessToken, inferAccountType } from '../utils/jwt.util.js';
import { ACCOUNT_DRIVER, ACCOUNT_USER, USER_ROLES, STAFF_ROLES } from '../constants/roles.js';
import { COOKIE_NAMES } from '../utils/cookie.util.js';

function readAccessToken(req) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.split(' ')[1];
  return req.cookies?.[COOKIE_NAMES.accessToken] || null;
}

/**
 * Common JWT verification and account fetching logic
 */
const authenticate = async (req, res, next, accountType, model, fieldName) => {
  const token = readAccessToken(req);
  if (!token) {
    return res.status(401).json({ status: 401, message: 'Not authorized, no token' });
  }

  try {
    const decoded = verifyAccessToken(token);
    const decodedAccountType = inferAccountType(decoded);

    if (decodedAccountType !== accountType) {
      return res.status(403).json({ status: 403, message: `Access denied. Not a ${accountType} account.` });
    }

    const entity = await model.findById(decoded.id);
    if (!entity || entity.isDeleted) {
      return res.status(401).json({ status: 401, message: 'Account not found or deactivated' });
    }

    req[fieldName] = entity;
    next();
  } catch (error) {
    const status = error.statusCode || 401;
    return res.status(status).json({ status, message: error.message || 'Not authorized' });
  }
};

/**
 * 1. Customer-only routes
 */
export const protectUser = (req, res, next) => {
  return authenticate(req, res, next, ACCOUNT_USER, User, 'user');
};

/**
 * Customer profile: own id only, or staff (admin / team_member) for any customer id.
 */
export const protectProfileViewer = async (req, res, next) => {
  const token = readAccessToken(req);
  if (!token) {
    return res.status(401).json({ status: 401, message: 'Not authorized, no token' });
  }

  try {
    const decoded = verifyAccessToken(token);
    if (inferAccountType(decoded) !== ACCOUNT_USER) {
      return res.status(403).json({ status: 403, message: 'Access denied' });
    }

    const entity = await User.findById(decoded.id);
    if (!entity || entity.isDeleted) {
      return res.status(401).json({ status: 401, message: 'Account not found or deactivated' });
    }

    const targetId = req.params.userId;
    if (STAFF_ROLES.includes(entity.role)) {
      if (!entity.isActive) {
        return res.status(403).json({ status: 403, message: 'Your account has been deactivated.' });
      }
      req.staff = entity;
      return next();
    }

    if (entity.role === USER_ROLES.USER && String(entity._id) === String(targetId)) {
      req.user = entity;
      return next();
    }

    return res.status(403).json({ status: 403, message: 'Access denied' });
  } catch (error) {
    const status = error.statusCode || 401;
    return res.status(status).json({ status, message: error.message || 'Not authorized' });
  }
};

/**
 * 2. Driver-only routes
 */
export const protectDriver = (req, res, next) => {
  return authenticate(req, res, next, ACCOUNT_DRIVER, Driver, 'driver');
};

/**
 * 3. Staff routes (Admin + Team Member)
 */
export const protectStaff = async (req, res, next) => {
  const token = readAccessToken(req);
  if (!token) {
    return res.status(401).json({ status: 401, message: 'Not authorized, no token' });
  }

  try {
    const decoded = verifyAccessToken(token);
    const decodedAccountType = inferAccountType(decoded);

    // Staff accounts are stored in the User collection with ACCOUNT_USER type
    if (decodedAccountType !== ACCOUNT_USER || !STAFF_ROLES.includes(decoded.role)) {
      return res.status(403).json({ status: 403, message: 'Not authorized for staff area' });
    }

    const staff = await User.findById(decoded.id);
    if (!staff || staff.isDeleted || !STAFF_ROLES.includes(staff.role)) {
      return res.status(401).json({ status: 401, message: 'Staff account not found' });
    }

    if (!staff.isActive) {
      return res.status(403).json({ status: 403, message: 'Your account has been deactivated. Please contact the administrator.' });
    }

    req.staff = staff;
    next();
  } catch (error) {
    const status = error.statusCode || 401;
    return res.status(status).json({ status, message: error.message || 'Not authorized' });
  }
};

/**
 * 4. Role Restriction Middleware
 * Use this after one of the protect middlewares
 */
export const restrictTo = (...roles) => {
  return (req, res, next) => {
    // Determine which entity is logged in
    const currentUser = req.staff || req.user || req.driver;
    
    if (!currentUser || !roles.includes(currentUser.role)) {
      return res.status(403).json({ 
        status: 403, 
        message: 'You do not have permission to perform this action' 
      });
    }
    next();
  };
};
