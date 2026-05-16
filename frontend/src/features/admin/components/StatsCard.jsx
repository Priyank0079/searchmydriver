import { TrendingUp, TrendingDown } from 'lucide-react';

/**
 * StatsCard — Admin dashboard stat card with icon, value, label, and trend.
 */
const StatsCard = ({ icon: Icon, label, value, trend, trendLabel, color = '#FFC107', className = '' }) => {
  const isPositive = trend >= 0;

  return (
    <div className={`bg-white rounded-2xl p-5 border border-gray-100 hover:shadow-md transition-shadow ${className}`}>
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${color}15` }}
        >
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold ${isPositive ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-text">{value}</p>
      <p className="text-xs text-text-muted mt-1">{label}</p>
      {trendLabel && (
        <p className="text-[10px] text-text-muted mt-0.5">{trendLabel}</p>
      )}
    </div>
  );
};

export default StatsCard;
