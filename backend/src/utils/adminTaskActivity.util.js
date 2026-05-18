export function appendTaskActivity(task, { action, by, byName = '', note = '' }) {
  if (!task.activityLog) task.activityLog = [];
  task.activityLog.push({
    action,
    by: by || null,
    byName: byName || '',
    note: note || '',
    at: new Date(),
  });
}
