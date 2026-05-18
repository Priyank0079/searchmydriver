export const TASK_TYPE = Object.freeze({
  DRIVER_REVIEW: 'driver_review',
  KIT_ORDER_REVIEW: 'kit_order_review',
  CUSTOMER_SUPPORT: 'customer_support',
});

export const TASK_CATEGORY = Object.freeze({
  REVIEW: 'review',
  SUPPORT: 'support',
  OPERATIONS: 'operations',
});

export const TASK_STATUS = Object.freeze({
  OPEN: 'open',
  ASSIGNED: 'assigned',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
});

export const OPEN_TASK_STATUSES = [
  TASK_STATUS.OPEN,
  TASK_STATUS.ASSIGNED,
  TASK_STATUS.IN_PROGRESS,
];

export const TASK_TYPE_LABELS = {
  [TASK_TYPE.DRIVER_REVIEW]: 'Driver review',
  [TASK_TYPE.KIT_ORDER_REVIEW]: 'Kit order review',
  [TASK_TYPE.CUSTOMER_SUPPORT]: 'Customer support',
};

export const TASK_CATEGORY_LABELS = {
  [TASK_CATEGORY.REVIEW]: 'Review',
  [TASK_CATEGORY.SUPPORT]: 'Support',
  [TASK_CATEGORY.OPERATIONS]: 'Operations',
};

/** Admin-only scopes */
export const TASK_SCOPE_OPTIONS = [
  { value: 'all', label: 'All open' },
  { value: 'mine', label: 'My tasks' },
  { value: 'unassigned', label: 'Unassigned' },
  { value: 'assigned', label: 'Assigned' },
];
