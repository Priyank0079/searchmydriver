import { Users, Car } from 'lucide-react';

const UserStats = ({ total, withCars }) => {
  const stats = [
    { label: 'Total Users', value: total, icon: Users, color: 'bg-primary/10', iconColor: 'text-primary' },
    { label: 'With Vehicles', value: withCars, icon: Car, color: 'bg-sky-100', iconColor: 'text-sky-600' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {stats.map((stat) => (
        <div key={stat.label} className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm">
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

export default UserStats;
