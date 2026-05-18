import api from '../../utils/api';
import { createQueryStore } from '../lib/createQueryStore';

export const useAdminTaskAssigneesStore = createQueryStore(async () => {
  const res = await api.get('/admin/tasks/assignees');
  return res.data?.data ?? [];
});

export const useAdminTaskSummaryStore = createQueryStore(async () => {
  const res = await api.get('/admin/tasks/summary');
  return res.data?.data ?? { unassigned: 0, mine: 0, allOpen: 0 };
});

export const useAdminTasksListStore = createQueryStore(
  async ({ scope, taskType, assigneeId, search, page, limit }) => {
    const params = new URLSearchParams({
      scope: scope || 'all',
      page: String(page ?? 1),
      limit: String(limit ?? 20),
    });
    if (taskType) params.append('taskType', taskType);
    if (assigneeId) params.append('assigneeId', assigneeId);
    if (search) params.append('search', search);

    const res = await api.get(`/admin/tasks?${params.toString()}`);
    const payload = res.data?.data ?? {};

    return {
      tasks: payload.tasks ?? [],
      pagination: payload.pagination ?? { total: 0, pages: 1 },
    };
  },
);

export async function assignAdminTasks({ taskIds, assigneeId, note }) {
  const res = await api.post('/admin/tasks/assign', { taskIds, assigneeId, note });
  return res.data?.data;
}

export async function assignAdminTask(taskId, { assigneeId, note }) {
  const res = await api.patch(`/admin/tasks/${taskId}/assign`, { assigneeId, note });
  return res.data?.data;
}

export async function claimAdminTask(taskId, note) {
  const res = await api.post(`/admin/tasks/${taskId}/claim`, { note });
  return res.data?.data;
}

export async function syncAdminReviewTasks() {
  const res = await api.post('/admin/tasks/sync');
  return res.data?.data;
}

export const useAdminTaskActivityStore = createQueryStore(
  async ({ taskType, category, taskId, page, limit }) => {
    const params = new URLSearchParams({
      page: String(page ?? 1),
      limit: String(limit ?? 50),
    });
    if (taskType) params.append('taskType', taskType);
    if (category) params.append('category', category);
    if (taskId) params.append('taskId', taskId);

    const res = await api.get(`/admin/tasks/activity?${params.toString()}`);
    const payload = res.data?.data ?? {};

    return {
      entries: payload.entries ?? [],
      pagination: payload.pagination ?? { total: 0, pages: 1 },
    };
  },
);
