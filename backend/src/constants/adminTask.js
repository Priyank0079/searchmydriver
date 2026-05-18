/** Task workflow status */
export const TASK_STATUS = Object.freeze({
  OPEN: 'open',
  ASSIGNED: 'assigned',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
});

/** High-level grouping for dashboards and filters */
export const TASK_CATEGORY = Object.freeze({
  REVIEW: 'review',
  SUPPORT: 'support',
  OPERATIONS: 'operations',
});

/** Concrete task kinds — add new entries here as workflows grow */
export const TASK_TYPE = Object.freeze({
  DRIVER_REVIEW: 'driver_review',
  KIT_ORDER_REVIEW: 'kit_order_review',
  CUSTOMER_SUPPORT: 'customer_support',
});

/** Mongoose resourceModel values (extend when linking new entities) */
export const TASK_RESOURCE_MODEL = Object.freeze({
  DRIVER: 'Driver',
  KIT_ORDER: 'KitOrder',
  USER: 'User',
});

export const OPEN_TASK_STATUSES = [
  TASK_STATUS.OPEN,
  TASK_STATUS.ASSIGNED,
  TASK_STATUS.IN_PROGRESS,
];

/**
 * Registry: single source of truth for task type metadata.
 * New types only need an entry here + upsert handler in adminTask.service.
 */
export const TASK_TYPE_REGISTRY = Object.freeze({
  [TASK_TYPE.DRIVER_REVIEW]: {
    category: TASK_CATEGORY.REVIEW,
    resourceModel: TASK_RESOURCE_MODEL.DRIVER,
    label: 'Driver review',
    defaultPriority: 'normal',
  },
  [TASK_TYPE.KIT_ORDER_REVIEW]: {
    category: TASK_CATEGORY.REVIEW,
    resourceModel: TASK_RESOURCE_MODEL.KIT_ORDER,
    label: 'Kit order review',
    defaultPriority: 'high',
  },
  [TASK_TYPE.CUSTOMER_SUPPORT]: {
    category: TASK_CATEGORY.SUPPORT,
    resourceModel: TASK_RESOURCE_MODEL.USER,
    label: 'Customer support',
    defaultPriority: 'normal',
  },
});

export const TASK_TYPES = Object.freeze(Object.keys(TASK_TYPE_REGISTRY));

export function getTaskTypeConfig(taskType) {
  return TASK_TYPE_REGISTRY[taskType] || null;
}

export function assertValidTaskType(taskType) {
  if (!TASK_TYPE_REGISTRY[taskType]) {
    throw new Error(`Unknown task type: ${taskType}`);
  }
}
