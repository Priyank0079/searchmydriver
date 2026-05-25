import { Outlet } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import { Home, MapPin, ClipboardList, User, Car, DollarSign } from 'lucide-react';
import BookingOfferModal from '../features/driver/trips/components/BookingOfferModal';

const userNavItems = [
  { path: '/user/home', label: 'Home', icon: Home },
  { path: '/user/book', label: 'Book', icon: MapPin, matchPaths: ['/user/book'] },
  { path: '/user/activity', label: 'Activity', icon: ClipboardList },
  { path: '/user/account', label: 'Account', icon: User },
];

const driverNavItems = [
  { path: '/driver/home', label: 'Home', icon: Home },
  { path: '/driver/trips', label: 'Trips', icon: Car },
  { path: '/driver/earnings', label: 'Earnings', icon: DollarSign },
  { path: '/driver/account', label: 'Account', icon: User },
];

export const UserDashboardLayout = () => {
  return (
    <div className="flex-1 flex flex-col pb-16">
      <Outlet />
      <BottomNav items={userNavItems} />
    </div>
  );
};

export const DriverDashboardLayout = () => {
  return (
    <div className="flex-1 flex flex-col pb-16">
      <Outlet />
      <BottomNav items={driverNavItems} />
      <BookingOfferModal />
    </div>
  );
};
