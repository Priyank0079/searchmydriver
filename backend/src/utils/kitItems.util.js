import { ApiError } from './apiError.js';

function slugVariantId(label) {
  return String(label || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || `v-${Date.now()}`;
}

export function getKitItemId(item, index) {
  if (item._id) return String(item._id);
  if (item.itemId) return String(item.itemId);
  return `idx-${index}`;
}

export function normalizeKitItems(items = []) {
  return items
    .filter((item) => item?.name?.trim())
    .map((item) => normalizeSingleKitItem(item));
}

function normalizeSingleKitItem(item) {
  const hasVariants = Boolean(item.hasVariants);
  const variants = hasVariants
    ? (item.variants || [])
        .filter((v) => v?.label?.trim())
        .map((v) => ({
          id: v.id?.trim() || slugVariantId(v.label),
          label: v.label.trim(),
        }))
    : [];

  if (hasVariants && variants.length === 0) {
    throw new ApiError(400, `Item "${item.name}" requires at least one variant`);
  }

  return {
    name: item.name.trim(),
    image: item.image || '',
    description: (item.description || '').trim(),
    qty: Math.max(1, Number(item.qty) || 1),
    hasVariants,
    variantLabel: hasVariants ? (item.variantLabel || 'Size').trim() : '',
    variants,
  };
}

export function validateAndBuildItemSelections(kitItems, selections = []) {
  if (!kitItems?.length) {
    throw new ApiError(400, 'Kit has no items configured');
  }

  const selectionMap = new Map(
    (selections || []).map((s) => [String(s.itemId), s]),
  );

  const itemSelections = kitItems.map((rawItem, index) => {
    const itemId = getKitItemId(rawItem, index);
    const pick = selectionMap.get(itemId);

    if (rawItem.hasVariants) {
      if (!pick?.variantId) {
        throw new ApiError(
          400,
          `Please select ${rawItem.variantLabel || 'size'} for ${rawItem.name}`,
        );
      }
      const variant = (rawItem.variants || []).find((v) => v.id === pick.variantId);
      if (!variant) {
        throw new ApiError(400, `Invalid selection for ${rawItem.name}`);
      }
      return {
        itemId,
        name: rawItem.name,
        image: rawItem.image || '',
        qty: rawItem.qty || 1,
        hasVariants: true,
        variantLabel: rawItem.variantLabel || 'Size',
        selectedVariant: { id: variant.id, label: variant.label },
      };
    }

    return {
      itemId,
      name: rawItem.name,
      image: rawItem.image || '',
      qty: rawItem.qty || 1,
      hasVariants: false,
      variantLabel: '',
      selectedVariant: null,
    };
  });

  const catalogItems = kitItems.map((item) => ({
    name: item.name,
    image: item.image || '',
    description: item.description || '',
    qty: item.qty || 1,
    hasVariants: Boolean(item.hasVariants),
    variantLabel: item.variantLabel || '',
    variants: item.variants || [],
  }));

  return { catalogItems, itemSelections };
}

export function formatItemSelectionLine(selection) {
  if (!selection) return '';
  if (selection.selectedVariant?.label) {
    return `${selection.name} (${selection.variantLabel}: ${selection.selectedVariant.label})`;
  }
  return selection.name;
}
