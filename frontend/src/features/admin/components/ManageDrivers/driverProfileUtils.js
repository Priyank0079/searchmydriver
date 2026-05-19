export const formatDate = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const formatAvailability = (availability) => {
  if (!availability) return '—';
  return availability.replace(/-/g, ' ');
};

export const getCarTypeLabel = (type) => {
  if (!type) return null;
  if (typeof type === 'object' && type.name) {
    return type.name.charAt(0).toUpperCase() + type.name.slice(1);
  }
  return null;
};

export const ONBOARDING_STEP_LABELS = {
  1: 'Identity',
  2: 'Credentials',
  3: 'Bank details',
  4: 'Safety & documents',
  5: 'Live verification',
  6: 'Training / submitted',
};
