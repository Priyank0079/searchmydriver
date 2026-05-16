import Card from '../../../../components/Card';
import Button from '../../../../components/Button';
import { TrendingUp, ArrowDown } from 'lucide-react';

const EarningsPage = () => {
  const weekData = [
    { day: 'Mon', amount: 450, height: 45 },
    { day: 'Tue', amount: 680, height: 68 },
    { day: 'Wed', amount: 320, height: 32 },
    { day: 'Thu', amount: 890, height: 89 },
    { day: 'Fri', amount: 1200, height: 100 },
    { day: 'Sat', amount: 960, height: 80 },
    { day: 'Sun', amount: 700, height: 58 },
  ];

  const stats = [
    { label: 'Today', amount: '₹850.00' },
    { label: 'This Week', amount: '₹5,200.00' },
    { label: 'This Month', amount: '₹16,880.00' },
  ];

  return (
    <div className="flex-1 flex flex-col bg-bg">
      <div className="bg-dark px-4 pt-4 pb-6 rounded-b-3xl">
        <h1 className="text-lg font-bold text-white mb-4">Earnings</h1>
        <Card className="!bg-white/10 backdrop-blur-sm !shadow-none">
          <p className="text-white/60 text-xs">This Week</p>
          <p className="text-3xl font-bold text-white mt-1">₹5,200.00</p>
          <div className="flex items-center gap-1 mt-1">
            <TrendingUp className="w-4 h-4 text-success" />
            <span className="text-success text-xs">+12% from last week</span>
          </div>
        </Card>
      </div>

      <div className="flex-1 p-4 -mt-3 space-y-4">
        {/* Chart */}
        <Card className="animate-fade-in-up">
          <div className="flex items-end justify-between h-32 gap-2">
            {weekData.map((d, i) => (
              <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full bg-primary/20 rounded-t-lg relative overflow-hidden" style={{ height: `${d.height}%` }}>
                  <div className="absolute bottom-0 w-full bg-primary rounded-t-lg animate-fade-in-up"
                    style={{ height: '100%', animationDelay: `${i * 0.08}s` }} />
                </div>
                <span className="text-[10px] text-text-muted">{d.day}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Stats */}
        <Card className="animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <div className="divide-y divide-border-light">
            {stats.map((stat) => (
              <div key={stat.label} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <span className="text-sm text-text-secondary">{stat.label}</span>
                <span className="text-sm font-bold text-text">{stat.amount}</span>
              </div>
            ))}
          </div>
        </Card>

        <Button fullWidth variant="danger" icon={ArrowDown}>Withdraw</Button>
      </div>
    </div>
  );
};

export default EarningsPage;
