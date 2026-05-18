import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, History, RefreshCw } from 'lucide-react';
import Select from '../../../components/Select';
import { useCachedQuery } from '../../../hooks/useCachedQuery';
import { buildCacheKey } from '../../../store/lib/buildCacheKey';
import { useAdminTaskActivityStore } from '../../../store/admin/useAdminTasksStore';
import ServerPaginatedTable from '../components/ServerPaginatedTable';
import { getTaskResourceLink } from '../components/ManageTasks/taskUtils';
import {
  TASK_CATEGORY,
  TASK_CATEGORY_LABELS,
  TASK_TYPE,
  TASK_TYPE_LABELS,
} from '../../../constants/adminTask';

const TaskActivityLogPage = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [taskType, setTaskType] = useState('');
  const [category, setCategory] = useState('');
  const limit = 50;

  const queryParams = useMemo(
    () => ({
      page,
      limit,
      taskType: taskType || undefined,
      category: category || undefined,
    }),
    [page, limit, taskType, category],
  );

  const cacheKey = buildCacheKey('admin-task-activity', queryParams);

  const { data, loading, error, refetch } = useCachedQuery(
    useAdminTaskActivityStore,
    cacheKey,
    queryParams,
  );

  const entries = data?.entries ?? [];
  const pagination = data?.pagination ?? { total: 0, pages: 1 };

  const columns = useMemo(
    () => [
      {
        key: 'at',
        label: 'When',
        width: '16%',
        render: (val) => (
          <span className="text-xs text-slate-600">
            {val ? new Date(val).toLocaleString() : '—'}
          </span>
        ),
      },
      {
        key: 'action',
        label: 'Action',
        width: '12%',
        render: (val) => (
          <span className="text-xs font-semibold uppercase text-slate-700">{val}</span>
        ),
      },
      {
        key: 'title',
        label: 'Task',
        width: '28%',
        render: (val, row) => (
          <div>
            <p className="text-sm font-medium text-slate-800">{val}</p>
            <p className="text-xs text-slate-500">
              {TASK_TYPE_LABELS[row.taskType] || row.taskType}
            </p>
          </div>
        ),
      },
      {
        key: 'byName',
        label: 'By',
        width: '14%',
        render: (val) => <span className="text-sm text-slate-600">{val || 'System'}</span>,
      },
      {
        key: 'note',
        label: 'Note',
        width: '30%',
        render: (val) => (
          <span className="text-sm text-slate-600 line-clamp-2">{val || '—'}</span>
        ),
      },
    ],
    [],
  );

  return (
    <div className="min-h-screen bg-slate-50 space-y-6 animate-fade-in-up pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link
            to="/admin/tasks"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to tasks
          </Link>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
            <History className="w-8 h-8 text-primary" />
            Task activity log
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Full audit trail of assignments and completions (admin only)
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={loading}
          className="h-11 px-4 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-2 shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="w-full sm:w-56">
          <Select
            value={taskType}
            onChange={(v) => {
              setTaskType(v);
              setPage(1);
            }}
            placeholder="All types"
            options={[
              { value: '', label: 'All types' },
              { value: TASK_TYPE.DRIVER_REVIEW, label: TASK_TYPE_LABELS[TASK_TYPE.DRIVER_REVIEW] },
              {
                value: TASK_TYPE.KIT_ORDER_REVIEW,
                label: TASK_TYPE_LABELS[TASK_TYPE.KIT_ORDER_REVIEW],
              },
            ]}
          />
        </div>
        <div className="w-full sm:w-48">
          <Select
            value={category}
            onChange={(v) => {
              setCategory(v);
              setPage(1);
            }}
            placeholder="All categories"
            options={[
              { value: '', label: 'All categories' },
              ...Object.values(TASK_CATEGORY).map((c) => ({
                value: c,
                label: TASK_CATEGORY_LABELS[c],
              })),
            ]}
          />
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <ServerPaginatedTable
        columns={columns}
        data={entries}
        loading={loading}
        limit={limit}
        page={page}
        pagination={pagination}
        onPageChange={setPage}
        onRowClick={(row) => {
          const link = getTaskResourceLink(row);
          if (link) navigate(link);
        }}
        entityLabel="entries"
        emptyMessage="No activity recorded yet"
      />
    </div>
  );
};

export default TaskActivityLogPage;
