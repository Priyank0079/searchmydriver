import AdminDetailModal from '../AdminDetailModal';
import Badge from '../../../../components/Badge';

const BookingDetailsModal = ({ isOpen, onClose, booking }) => {
  if (!booking) return null;

  const getStatusBadge = (status) => {
    const variants = {
      completed: 'success',
      started: 'primary',
      driver_assigned: 'primary',
      arrived: 'primary',
      searching: 'warning',
      cancelled: 'danger',
    };
    return (
      <Badge variant={variants[status] || 'default'} className="capitalize">
        {status?.replace(/_/g, ' ') || ''}
      </Badge>
    );
  };

  return (
    <AdminDetailModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Booking ${booking.bookingNumber}`}
      subtitle={`Created on ${new Date(booking.createdAt).toLocaleString()}`}
      headerExtra={
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl sm:text-2xl font-semibold text-slate-900">
              {booking.bookingNumber}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {new Date(booking.createdAt).toLocaleString()}
            </p>
          </div>
          {getStatusBadge(booking.status)}
        </div>
      }
    >
      <div className="space-y-6">
        {/* Service Info */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Service Details</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500">Service Type</p>
              <p className="font-medium capitalize">{booking.serviceType}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Booking Type</p>
              <p className="font-medium capitalize">{booking.bookingType}</p>
            </div>
          </div>
        </div>

        {/* Locations */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Trip Details</h3>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-slate-500">Pickup</p>
              <p className="text-sm">{booking.pickup?.address || 'N/A'}</p>
            </div>
            {booking.dropoff?.address && (
              <div>
                <p className="text-xs text-slate-500">Dropoff</p>
                <p className="text-sm">{booking.dropoff.address}</p>
              </div>
            )}
          </div>
        </div>

        {/* Fare Snapshot */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Fare & Payment</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Base Fare</span>
              <span>₹{booking.fareSnapshot?.baseFare || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Extras</span>
              <span>₹{booking.fareSnapshot?.extras || 0}</span>
            </div>
            <div className="flex justify-between font-semibold pt-2 border-t border-slate-100">
              <span>Total</span>
              <span>₹{booking.fareSnapshot?.total || 0}</span>
            </div>
            <div className="flex justify-between text-sm pt-2">
              <span className="text-slate-500">Payment Status</span>
              <span className="capitalize">{booking.paymentStatus}</span>
            </div>
          </div>
        </div>

        {/* User & Driver */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-800 mb-3">Customer</h3>
            {booking.userId ? (
              <div>
                <p className="font-medium">{booking.userId.name}</p>
                <p className="text-sm text-slate-500">{booking.userId.phone_no}</p>
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic">Unknown</p>
            )}
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-800 mb-3">Assigned Driver</h3>
            {booking.driverId ? (
              <div>
                <p className="font-medium">{booking.driverId.name}</p>
                <p className="text-sm text-slate-500">{booking.driverId.phone_no}</p>
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic">Unassigned</p>
            )}
          </div>
        </div>
      </div>
    </AdminDetailModal>
  );
};

export default BookingDetailsModal;
