import { Search, UserPlus } from 'lucide-react';
import Button from '../../../../components/Button';

const TeamFilters = ({ search, onSearchChange, onAddMember }) => {
  return (
    <div className="sticky top-0 z-20 bg-slate-50/90 backdrop-blur-md pb-2">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Team Management</h1>
          <p className="text-sm text-slate-500 mt-1">Onboard and manage administrative staff roles</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          {/* SEARCH */}
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full h-12 pl-11 pr-4 rounded-2xl border border-slate-200 bg-white shadow-sm text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all"
            />
          </div>

          <Button
            onClick={onAddMember}
            className="flex items-center gap-2 h-12 px-6 shadow-lg shadow-primary/20 whitespace-nowrap rounded-2xl"
          >
            <UserPlus className="w-4.5 h-4.5" />
            <span>Add Member</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TeamFilters;
