import { Navigate, Outlet } from 'react-router-dom';
import useDriverAuthStore from '../store/useDriverAuthStore';

const DriverGuard = () => {
  const { isAuthenticated, driver } = useDriverAuthStore();

  if (!isAuthenticated || !driver) {
    return <Navigate to="/driver/login" replace />;
  }

  if (driver.onboardingStep < 4) {
    if (driver.onboardingStep === 1) return <Navigate to="/driver/register/credentials" replace />;
    if (driver.onboardingStep === 2) return <Navigate to="/driver/register/bank" replace />;
    if (driver.onboardingStep === 3) return <Navigate to="/driver/register/safety" replace />;
    return <Navigate to="/driver/register/credentials" replace />;
  }

  if (driver.approvalStatus !== 'approved') {
    return <Navigate to="/driver/register/approval" replace />;
  }

  return <Outlet />;
};

export default DriverGuard;
