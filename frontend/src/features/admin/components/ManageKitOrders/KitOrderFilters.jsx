import { RefreshCw, Search, Filter } from 'lucide-react';
import Select from '../../../../components/Select';
import AssigneeFilterSelect from '../ManageTasks/AssigneeFilterSelect';

const KitOrderFilters = ({
  search,
  onSearchChange,
  statusFilter,
  onStatusChange,
  assigneeFilter,
  onAssigneeChange,
  onRefresh,
  refreshing,
}) => (
  <div className="sticky top-0 z-20 bg-slate-50/90 backdrop-blur-md pb-2">
    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Kit orders</h1>
        <p className="text-sm text-slate-500 mt-1">Purchase requests, payments, and dispatch</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search driver..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full h-12 pl-11 pr-4 rounded-2xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-4 focus:ring-primary/10"
          />
        </div>
        <div className="w-full sm:w-56">
          <Select
            value={statusFilter}
            onChange={onStatusChange}
            placeholder="All"
            options={[
              { value: '', label: 'All orders' },
              { value: 'pending_approval', label: 'Awaiting approval' },
            ]}
            icon={Filter}
          />
        </div>
        {onAssigneeChange && (
          <div className="w-full sm:w-56">
            <AssigneeFilterSelect
              value={assigneeFilter}
              onChange={onAssigneeChange}
            />
          </div>
        )}
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="h-12 px-4 rounded-2xl border border-slate-200 bg-white text-sm font-semibold inline-flex items-center gap-2 shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        )}
      </div>
    </div>
  </div>
);

export default KitOrderFilters;
