import { Navigate, Outlet, useLocation } from 'react-router-dom';
import useDriverAuthStore from '../store/useDriverAuthStore';

const OnboardingGuard = () => {
  const { isAuthenticated, driver } = useDriverAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/driver/login" replace />;
  }

  // If already approved, go to home
  if (driver?.approvalStatus === 'approved') {
    return <Navigate to="/driver/home" replace />;
  }

  // If application is submitted, or restricted and trying to access registration steps
  const isSubmitted = driver?.onboardingStep === 5;
  const isRestrictedStatus = ['under_review', 'rejected', 'suspended'].includes(driver?.approvalStatus);

  const path = location.pathname;

  // If they have finished all steps, they should only be on the approval page
  if ((isSubmitted || (isRestrictedStatus && driver?.onboardingStep >= 4)) && !path.includes('/register/approval')) {
    return <Navigate to="/driver/register/approval" replace />;
  }

  // Redirect based on completed steps for those still in the process
  const step = driver?.onboardingStep || 1;

  // Protect steps based on current progress
  if (path.includes('/register/credentials') && step < 1) return <Navigate to="/driver/register/identity" replace />;
  if (path.includes('/register/bank') && step < 2) return <Navigate to="/driver/register/credentials" replace />;
  if (path.includes('/register/safety') && step < 3) return <Navigate to="/driver/register/bank" replace />;
  if (path.includes('/register/approval') && step < 4) return <Navigate to="/driver/register/safety" replace />;

  return <Outlet />;
};

export default OnboardingGuard;
