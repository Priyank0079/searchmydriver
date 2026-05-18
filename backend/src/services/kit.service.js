import DriverKit from '../models/driverKit.model.js';
import KitOrder from '../models/kitOrder.model.js';
import { ApiError } from '../utils/apiError.js';
import { normalizeKitItems } from '../utils/kitItems.util.js';

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export const createKitService = async (staffId, data) => {
  const { name, description, price, currency, items, isMandatory, isActive, sortOrder } = data;

  if (!name || !price) {
    throw new ApiError(400, 'Name and price are required');
  }

  const normalizedItems = normalizeKitItems(items || []);
  if (!normalizedItems.length) {
    throw new ApiError(400, 'Add at least one kit item');
  }

  let slug = slugify(data.slug || name);
  const exists = await DriverKit.findOne({ slug });
  if (exists) slug = `${slug}-${Date.now()}`;

  return DriverKit.create({
    name,
    slug,
    description: description || '',
    price,
    currency: currency || 'INR',
    items: normalizedItems,
    isMandatory: isMandatory !== false,
    isActive: isActive !== false,
    sortOrder: sortOrder || 0,
    createdBy: staffId,
  });
};

export const getKitsService = async (query = {}) => {
  const { activeOnly } = query;
  const filter = {};
  if (activeOnly === 'true' || activeOnly === true) filter.isActive = true;

  return DriverKit.find(filter).sort({ sortOrder: 1, createdAt: -1 });
};

export const getKitByIdService = async (id) => {
  const kit = await DriverKit.findById(id);
  if (!kit) throw new ApiError(404, 'Kit not found');
  return kit;
};

export const updateKitService = async (id, data) => {
  const kit = await DriverKit.findById(id);
  if (!kit) throw new ApiError(404, 'Kit not found');

  const fields = ['name', 'description', 'price', 'currency', 'isMandatory', 'isActive', 'sortOrder'];
  fields.forEach((key) => {
    if (data[key] !== undefined) kit[key] = data[key];
  });

  if (data.items !== undefined) {
    kit.items = normalizeKitItems(data.items);
    if (!kit.items.length) {
      throw new ApiError(400, 'Add at least one kit item');
    }
    kit.version = (kit.version || 1) + 1;
  } else if (data.price !== undefined) {
    kit.version = (kit.version || 1) + 1;
  }

  if (data.name && data.slug) {
    kit.slug = slugify(data.slug);
  }

  await kit.save();
  return kit;
};

export const getMandatoryKitService = async () => {
  const kit = await DriverKit.findOne({ isMandatory: true, isActive: true }).sort({ sortOrder: 1 });
  return kit;
};

export const deleteKitService = async (id) => {
  const kit = await DriverKit.findById(id);
  if (!kit) throw new ApiError(404, 'Kit not found');

  const orderCount = await KitOrder.countDocuments({ kitId: id });
  if (orderCount > 0) {
    throw new ApiError(
      400,
      `Cannot delete this kit — ${orderCount} order(s) are linked. Deactivate it instead.`,
    );
  }

  await DriverKit.findByIdAndDelete(id);
  return { id, deleted: true };
};
