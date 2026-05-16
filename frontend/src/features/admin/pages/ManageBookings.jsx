import DataTable from '../components/DataTable';
import Badge from '../../../components/Badge';
import { ADMIN_MOCK_BOOKINGS } from '../../../utils/constants';

const ManageBookings = () => {
  const columns = [
    {
      key: 'id',
      label: 'Booking ID',
      width: '15%',
      render: (val) => <span className="font-mono font-medium text-xs bg-gray-100 px-2 py-1 rounded">{val}</span>,
    },
    {
      key: 'user',
      label: 'Customer',
      width: '20%',
      render: (val) => <span className="font-semibold text-sm">{val}</span>,
    },
    {
      key: 'driver',
      label: 'Assigned Driver',
      width: '20%',
      render: (val) => val ? (
        <span className="text-sm">{val}</span>
      ) : (
        <span className="text-xs text-text-muted italic">Unassigned</span>
      ),
    },
    {
      key: 'serviceType',
      label: 'Service',
      width: '15%',
    },
    {
      key: 'fare',
      label: 'Est. Fare',
      width: '10%',
      render: (val) => <span className="font-medium text-success">₹{val}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      width: '10%',
      render: (val) => {
        const variants = {
          completed: 'success',
          in_progress: 'primary',
          pending: 'warning',
          cancelled: 'danger',
        };
        return <Badge variant={variants[val]} text={val.replace('_', ' ')} />;
      },
    },
    {
      key: 'date',
      label: 'Date',
      width: '10%',
      render: (val) => new Date(val).toLocaleDateString(),
    },
  ];

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-text">Booking History</h2>
      </div>

      <DataTable
        columns={columns}
        data={ADMIN_MOCK_BOOKINGS}
        searchPlaceholder="Search by ID, user, or driver..."
        pageSize={10}
      />
    </div>
  );
};

export default ManageBookings;
