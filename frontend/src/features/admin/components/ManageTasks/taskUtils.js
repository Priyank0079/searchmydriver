import { OPEN_TASK_STATUSES } from '../../../../constants/adminTask';
import { hasOperationalAccess } from '../../../../constants/staffRoles';

export function isOpenTask(task) {
  return task && OPEN_TASK_STATUSES.includes(task.status);
}

export function getAssigneeName(task) {
  if (!task?.assignedTo) return null;
  if (typeof task.assignedTo === 'object') {
    return task.assignedTo.name || task.assignedTo.email || 'Assigned';
  }
  return 'Assigned';
}

export function canStaffActOnTask(staff, task) {
  if (!staff) return false;
  if (hasOperationalAccess(staff.role)) return true;
  if (!isOpenTask(task)) return true;
  if (!task?.assignedTo) return false;
  const assigneeId =
    typeof task.assignedTo === 'object' ? task.assignedTo._id : task.assignedTo;
  return String(assigneeId) === String(staff._id);
}

export function getTaskResourceLink(task) {
  if (!task) return null;
  if (task.taskType === 'driver_review') {
    return `/admin/drivers/${task.resourceId}/profile`;
  }
  if (task.taskType === 'kit_order_review') {
    return `/admin/kit-orders/${task.resourceId}`;
  }
  return null;
}
