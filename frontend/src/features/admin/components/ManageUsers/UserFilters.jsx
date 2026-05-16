import { Search } from 'lucide-react';

const UserFilters = ({ search, onSearchChange }) => (
  <div className="sticky top-0 z-20 bg-slate-50/90 backdrop-blur-md pb-2">
    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Manage Users</h1>
        <p className="text-sm text-slate-500 mt-1">View customer accounts, vehicles, and onboarding</p>
      </div>

      <div className="relative w-full lg:w-80">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search by name, email, or phone..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full h-12 pl-11 pr-4 rounded-2xl border border-slate-200 bg-white shadow-sm text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all"
        />
      </div>
    </div>
  </div>
);

export default UserFilters;
