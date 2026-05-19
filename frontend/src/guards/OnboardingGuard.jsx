import { Navigate, Outlet, useLocation } from 'react-router-dom';
import useDriverAuthStore from '../store/useDriverAuthStore';
import { driverNeedsPhone } from '../features/auth/utils/authNavigation';

const OnboardingGuard = () => {
  const { isAuthenticated, driver } = useDriverAuthStore();
  const location = useLocation();
  const path = location.pathname;

  if (!isAuthenticated) {
    return <Navigate to="/driver/login" replace />;
  }

  if (driverNeedsPhone(driver)) {
    return <Navigate to="/driver/link-phone" replace />;
  }

  const step = driver?.onboardingStep ?? 0;

  if (driver?.approvalStatus === 'approved' && step >= 5) {
    return <Navigate to="/driver/home" replace />;
  }

  const isSubmitted = step >= 5;
  const isRestrictedStatus = ['under_review', 'rejected', 'suspended'].includes(
    driver?.approvalStatus,
  );

  if (isSubmitted || (isRestrictedStatus && step >= 5)) {
    if (!path.includes('/register/approval')) {
      return <Navigate to="/driver/register/approval" replace />;
    }
    return <Outlet />;
  }

  if (path.includes('/register/credentials') && step < 1) {
    return <Navigate to="/driver/register/identity" replace />;
  }
  if (path.includes('/register/bank') && step < 2) {
    return <Navigate to="/driver/register/credentials" replace />;
  }
  if (path.includes('/register/safety') && step < 3) {
    return <Navigate to="/driver/register/bank" replace />;
  }
  if (path.includes('/register/training') && step < 4) {
    return <Navigate to="/driver/register/safety" replace />;
  }
  if (path.includes('/register/approval') && step < 5) {
    return <Navigate to="/driver/register/training" replace />;
  }

  if (isSubmitted && path.includes('/register/training')) {
    return <Navigate to="/driver/register/approval" replace />;
  }

  return <Outlet />;
};

export default OnboardingGuard;
