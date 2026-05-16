import { Navigate, Outlet } from 'react-router-dom';
import useDriverAuthStore from '../store/useDriverAuthStore';

const DriverGuard = () => {
  const { isAuthenticated, driver } = useDriverAuthStore();

  if (!isAuthenticated || !driver) {
    return <Navigate to="/driver/login" replace />;
  }

  const step = driver.onboardingStep || 1;

  if (step < 5) {
    if (step === 1) return <Navigate to="/driver/register/credentials" replace />;
    if (step === 2) return <Navigate to="/driver/register/bank" replace />;
    if (step === 3) return <Navigate to="/driver/register/safety" replace />;
    if (step === 4) return <Navigate to="/driver/register/training" replace />;
    return <Navigate to="/driver/register/credentials" replace />;
  }

  if (driver.approvalStatus !== 'approved') {
    return <Navigate to="/driver/register/approval" replace />;
  }

  return <Outlet />;
};

export default DriverGuard;
