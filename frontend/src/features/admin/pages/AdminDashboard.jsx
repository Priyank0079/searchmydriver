import { Users, Car, CalendarCheck, DollarSign } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import StatsCard from '../components/StatsCard';
import DataTable from '../components/DataTable';
import Badge from '../../../components/Badge';
import Avatar from '../../../components/Avatar';
import { ADMIN_MOCK_DRIVERS, ADMIN_MOCK_BOOKINGS } from '../../../utils/constants';
import useAdminAuthStore from '../../../store/useAdminAuthStore';

const AdminDashboard = () => {
  const { admin } = useAdminAuthStore();

  // Role Protection: Team members go straight to Drivers page
  if (admin?.role !== 'admin') {
    return <Navigate to="/admin/drivers" replace />;
  }

  const recentDrivers = ADMIN_MOCK_DRIVERS.slice(0, 4);
  const recentBookings = ADMIN_MOCK_BOOKINGS.slice(0, 4);

  const driverColumns = [
    {
      key: 'name',
      label: 'Driver',
      render: (val, row) => (
        <div className="flex items-center gap-3">
          <Avatar name={val} size="sm" />
          <div>
            <p className="font-semibold">{val}</p>
            <p className="text-[10px] text-text-muted">{row.phone}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'approvalStatus',
      label: 'Status',
      render: (val) => {
        const variants = {
          approved: 'success',
          pending: 'warning',
          rejected: 'danger',
          under_review: 'info',
        };
        return <Badge variant={variants[val]} text={val.replace('_', ' ')} />;
      },
    },
    {
      key: 'createdAt',
      label: 'Joined',
      render: (val) => new Date(val).toLocaleDateString(),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          icon={Users}
          label="Total Users"
          value="1,245"
          trend={12}
          trendLabel="vs last month"
          color="#3498DB"
        />
        <StatsCard
          icon={Car}
          label="Total Drivers"
          value="342"
          trend={8}
          trendLabel="vs last month"
          color="#2ECC71"
        />
        <StatsCard
          icon={CalendarCheck}
          label="Bookings Today"
          value="89"
          trend={-3}
          trendLabel="vs yesterday"
          color="#F39C12"
        />
        <StatsCard
          icon={DollarSign}
          label="Revenue (Month)"
          value="₹1.2L"
          trend={15}
          trendLabel="vs last month"
          color="#9B59B6"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Drivers */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-text">Recent Drivers</h2>
            <button className="text-sm font-semibold text-primary hover:text-primary-dark transition-colors">
              View All
            </button>
          </div>
          <DataTable
            columns={driverColumns}
            data={recentDrivers}
            searchPlaceholder="Search drivers..."
            pageSize={5}
          />
        </div>

        {/* Recent Bookings */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-text">Live Bookings</h2>
            <button className="text-sm font-semibold text-primary hover:text-primary-dark transition-colors">
              View All
            </button>
          </div>
          <DataTable
            columns={[
              { key: 'id', label: 'ID', render: (val) => <span className="font-mono text-xs">{val}</span> },
              { key: 'serviceType', label: 'Service' },
              {
                key: 'status',
                label: 'Status',
                render: (val) => (
                  <Badge
                    variant={val === 'completed' ? 'success' : val === 'pending' ? 'warning' : 'info'}
                    text={val.replace('_', ' ')}
                  />
                ),
              },
            ]}
            data={recentBookings}
            searchPlaceholder="Search bookings..."
            pageSize={5}
          />
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
