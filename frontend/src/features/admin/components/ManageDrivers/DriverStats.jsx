import { Users, Clock3, CheckCircle2, XCircle, Ban } from 'lucide-react';

const DriverStats = ({ total, pending, approved, rejected, suspended = 0 }) => {
  const stats = [
    { label: 'Total Drivers', value: total, icon: Users, color: 'bg-primary/10', iconColor: 'text-primary' },
    { label: 'Pending', value: pending, icon: Clock3, color: 'bg-amber-100', iconColor: 'text-amber-600' },
    { label: 'Approved', value: approved, icon: CheckCircle2, color: 'bg-emerald-100', iconColor: 'text-emerald-600' },
    { label: 'Rejected', value: rejected, icon: XCircle, color: 'bg-rose-100', iconColor: 'text-rose-600' },
    { label: 'Suspended', value: suspended, icon: Ban, color: 'bg-slate-100', iconColor: 'text-slate-600' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
      {stats.map((stat, i) => (
        <div key={i} className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">{stat.label}</p>
              <h2 className={`text-3xl font-bold mt-2 ${stat.iconColor}`}>{stat.value}</h2>
            </div>
            <div className={`w-12 h-12 rounded-2xl ${stat.color} flex items-center justify-center`}>
              <stat.icon className={`w-6 h-6 ${stat.iconColor}`} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default DriverStats;
