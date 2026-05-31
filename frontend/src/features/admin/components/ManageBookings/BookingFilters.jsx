import { Filter, RefreshCw, Search } from 'lucide-react';
import Select from '../../../../components/Select';

const BookingFilters = ({
  search,
  onSearchChange,
  statusFilter,
  onStatusChange,
  onRefresh,
  refreshing = false,
}) => {
  return (
    <div className="sticky top-0 z-20 bg-slate-50/90 backdrop-blur-md pb-2">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Manage Bookings</h1>
          <p className="text-sm text-slate-500 mt-1">Review, search and manage all platform bookings</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          {/* SEARCH */}
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by ID or customer..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full h-12 pl-11 pr-4 rounded-2xl border border-slate-200 bg-white shadow-sm text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all"
            />
          </div>

          {/* FILTER */}
          <div className="w-full sm:w-60">
            <Select
              value={statusFilter}
              onChange={(val) => onStatusChange(val)}
              placeholder="All Statuses"
              options={[
                { value: '', label: 'All Statuses' },
                { value: 'searching', label: 'Searching' },
                { value: 'driver_assigned', label: 'Driver Assigned' },
                { value: 'arrived', label: 'Arrived' },
                { value: 'started', label: 'Started' },
                { value: 'completed', label: 'Completed' },
                { value: 'cancelled', label: 'Cancelled' },
              ]}
              icon={Filter}
            />
          </div>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="h-12 px-4 rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 inline-flex items-center gap-2 shrink-0"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BookingFilters;
