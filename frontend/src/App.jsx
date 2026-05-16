import { Routes, Route, Navigate } from 'react-router-dom';
import MobileLayout from './layouts/MobileLayout';
import AuthLayout from './layouts/AuthLayout';
import { UserDashboardLayout, DriverDashboardLayout } from './layouts/DashboardLayout';

// Auth
import WelcomePage from './features/auth/pages/WelcomePage';
import LoginPage from './features/auth/pages/LoginPage';
import RegisterPage from './features/auth/pages/RegisterPage';
import ForgotPasswordPage from './features/auth/pages/ForgotPasswordPage';

// User Onboarding
import AddCarPage from './features/user/onboarding/pages/AddCarPage';
import MyCarsPage from './features/user/onboarding/pages/MyCarsPage';
import RegistrationChecklistPage from './features/user/onboarding/pages/RegistrationChecklistPage';
import ChooseServicePage from './features/user/onboarding/pages/ChooseServicePage';

// User Home
import UserHomePage from './features/user/home/pages/UserHomePage';

// User Booking
import SelectServicePage from './features/user/booking/pages/SelectServicePage';
import SelectDurationPage from './features/user/booking/pages/SelectDurationPage';
import ReviewBookingPage from './features/user/booking/pages/ReviewBookingPage';
import PaymentPage from './features/user/booking/pages/PaymentPage';
import SearchingDriverPage from './features/user/booking/pages/SearchingDriverPage';
import DriverAssignedPage from './features/user/booking/pages/DriverAssignedPage';

// User Tracking
import DriverOnWayPage from './features/user/tracking/pages/DriverOnWayPage';
import DriverReachedPage from './features/user/tracking/pages/DriverReachedPage';
import TripInProgressPage from './features/user/tracking/pages/TripInProgressPage';
import TripCompletedPage from './features/user/tracking/pages/TripCompletedPage';
import RatePayPage from './features/user/tracking/pages/RatePayPage';
import InvoicePage from './features/user/tracking/pages/InvoicePage';

// User Dashboard
import ActivityPage from './features/user/activity/pages/ActivityPage';
import UserAccountPage from './features/user/account/pages/UserAccountPage';

// Driver Registration
import DriverLoginPage from './features/driver/auth/pages/DriverLoginPage';
import DriverSignUpPage from './features/driver/registration/pages/DriverSignUpPage';
import IdentityDetailsPage from './features/driver/registration/pages/IdentityDetailsPage';
import DrivingCredentialsPage from './features/driver/registration/pages/DrivingCredentialsPage';
import BankDetailsPage from './features/driver/registration/pages/BankDetailsPage';
import SafetyProtocolPage from './features/driver/registration/pages/SafetyProtocolPage';
import TrainingPage from './features/driver/registration/pages/TrainingPage';
import ProfileUnderReviewPage from './features/driver/registration/pages/ProfileUnderReviewPage';

// Driver Home & Trips
import DriverHomePage from './features/driver/home/pages/DriverHomePage';
import NewBookingRequestPage from './features/driver/trips/pages/NewBookingRequestPage';
import NavigateToCustomerPage from './features/driver/trips/pages/NavigateToCustomerPage';
import ArrivedStartTripPage from './features/driver/trips/pages/ArrivedStartTripPage';
import DriverTripInProgressPage from './features/driver/trips/pages/DriverTripInProgressPage';
import DriverTripCompletedPage from './features/driver/trips/pages/DriverTripCompletedPage';
import PaymentStatusPage from './features/driver/trips/pages/PaymentStatusPage';
import RateCustomerPage from './features/driver/trips/pages/RateCustomerPage';
import MyTripsPage from './features/driver/trips/pages/MyTripsPage';

// Driver Dashboard
import EarningsPage from './features/driver/earnings/pages/EarningsPage';
import DriverAccountPage from './features/driver/account/pages/DriverAccountPage';

// Admin Layout & Guard
import AdminGuard from './guards/AdminGuard';
import DriverGuard from './guards/DriverGuard';
import OnboardingGuard from './guards/OnboardingGuard';
import UserOnboardingGuard from './guards/UserOnboardingGuard';
import AdminLayout from './layouts/AdminLayout';

// Admin Pages
import AdminLoginPage from './features/auth/pages/AdminLoginPage';
import AccountInactive from './features/admin/pages/AccountInactive';
import AdminDashboard from './features/admin/pages/AdminDashboard';
import ManageDrivers from './features/admin/pages/ManageDrivers';
import DriverProfilePage from './features/admin/pages/DriverProfilePage';
import ManageUsers from './features/admin/pages/ManageUsers';
import UserProfilePage from './features/admin/pages/UserProfilePage';
import ManageBookings from './features/admin/pages/ManageBookings';
import PlatformSettings from './features/admin/pages/PlatformSettings';
import PaymentSettings from './features/admin/pages/PaymentSettings';
import ManageTeam from './features/admin/pages/ManageTeam';

function App() {
  return (
    <Routes>
      <Route element={<MobileLayout />}>
        {/* ========== Auth Routes ========== */}
        <Route element={<AuthLayout />}>
          <Route path="/" element={<WelcomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Route>

        {/* ========== User Onboarding ========== */}
        <Route element={<UserOnboardingGuard />}>
          <Route path="/user/add-car" element={<AddCarPage />} />
          <Route path="/user/my-cars" element={<MyCarsPage />} />
          <Route path="/user/checklist" element={<RegistrationChecklistPage />} />
          <Route path="/user/choose-service" element={<ChooseServicePage />} />

          {/* ========== User Dashboard (with bottom nav) ========== */}
          <Route element={<UserDashboardLayout />}>
            <Route path="/user/home" element={<UserHomePage />} />
            <Route path="/user/book" element={<Navigate to="/user/book/service" replace />} />
            <Route path="/user/activity" element={<ActivityPage />} />
            <Route path="/user/account" element={<UserAccountPage />} />
          </Route>
        </Route>

        {/* ========== User Booking Flow ========== */}
        <Route path="/user/book/service" element={<SelectServicePage />} />
        <Route path="/user/book/duration" element={<SelectDurationPage />} />
        <Route path="/user/book/review" element={<ReviewBookingPage />} />
        <Route path="/user/book/payment" element={<PaymentPage />} />
        <Route path="/user/book/searching" element={<SearchingDriverPage />} />
        <Route path="/user/book/assigned" element={<DriverAssignedPage />} />
        {/* ========== User Tracking Flow ========== */}
        <Route path="/user/tracking/on-way" element={<DriverOnWayPage />} />
        <Route path="/user/tracking/reached" element={<DriverReachedPage />} />
        <Route path="/user/tracking/in-progress" element={<TripInProgressPage />} />
        <Route path="/user/tracking/completed" element={<TripCompletedPage />} />
        <Route path="/user/tracking/rate" element={<RatePayPage />} />
        <Route path="/user/tracking/invoice" element={<InvoicePage />} />

        {/* ========== Driver Registration ========== */}
        <Route path="/driver/login" element={<DriverLoginPage />} />
        <Route path="/driver/signup" element={<DriverSignUpPage />} />
        <Route path="/driver/register/identity" element={<IdentityDetailsPage />} />
        
        <Route element={<OnboardingGuard />}>
          <Route path="/driver/register/credentials" element={<DrivingCredentialsPage />} />
          <Route path="/driver/register/bank" element={<BankDetailsPage />} />
          <Route path="/driver/register/safety" element={<SafetyProtocolPage />} />
          <Route path="/driver/register/training" element={<TrainingPage />} />
          <Route path="/driver/register/approval" element={<ProfileUnderReviewPage />} />
        </Route>

        {/* ========== Protected Driver Routes ========== */}
        <Route element={<DriverGuard />}>
          {/* ========== Driver Dashboard (with bottom nav) ========== */}
          <Route element={<DriverDashboardLayout />}>
            <Route path="/driver/home" element={<DriverHomePage />} />
            <Route path="/driver/trips" element={<MyTripsPage />} />
            <Route path="/driver/earnings" element={<EarningsPage />} />
            <Route path="/driver/account" element={<DriverAccountPage />} />
          </Route>

          {/* ========== Driver Trip Flow ========== */}
          <Route path="/driver/trip/new-request" element={<NewBookingRequestPage />} />
          <Route path="/driver/trip/navigate" element={<NavigateToCustomerPage />} />
          <Route path="/driver/trip/arrived" element={<ArrivedStartTripPage />} />
          <Route path="/driver/trip/in-progress" element={<DriverTripInProgressPage />} />
          <Route path="/driver/trip/completed" element={<DriverTripCompletedPage />} />
          <Route path="/driver/trip/payment" element={<PaymentStatusPage />} />
          <Route path="/driver/trip/rate" element={<RateCustomerPage />} />
        </Route>

        {/* Catch all for mobile */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>

      {/* ========== Admin Web Panel (Outside MobileLayout) ========== */}
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin/inactive" element={<AccountInactive />} />
      <Route element={<AdminGuard />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<ManageUsers />} />
          <Route path="/admin/users/:userId/profile" element={<UserProfilePage />} />
          <Route path="/admin/drivers" element={<ManageDrivers />} />
          <Route path="/admin/drivers/:driverId/profile" element={<DriverProfilePage />} />
          <Route path="/admin/bookings" element={<ManageBookings />} />
          <Route path="/admin/settings" element={<Navigate to="/admin/settings/platform" replace />} />
          <Route path="/admin/settings/platform" element={<PlatformSettings />} />
          <Route path="/admin/settings/team" element={<ManageTeam />} />
          <Route path="/admin/settings/payment" element={<PaymentSettings />} />
          {/* Note: Revenue page is mapped to Dashboard for now to save scope, or can be a separate page later */}
          <Route path="/admin/revenue" element={<Navigate to="/admin" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
