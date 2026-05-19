export function userNeedsPhone(user) {
  if (!user) return false;
  const phone = String(user.phone_no || '').trim();
  if (phone.length === 10) return false;
  return Boolean(user.needsPhone) || !phone;
}

export function driverNeedsPhone(driver) {
  if (!driver) return false;
  const phone = String(driver.phone || '').trim();
  if (phone.length === 10) return false;
  return Boolean(driver.needsPhone) || !phone;
}

export function navigateDriverAfterAuth(navigate, driver, needsPhone) {
  if (needsPhone || driverNeedsPhone(driver)) {
    navigate('/driver/link-phone', { replace: true });
    return;
  }

  if (driver.approvalStatus === 'approved') {
    navigate('/driver/home', { replace: true });
    return;
  }

  if (driver.onboardingStep < 5) {
    const stepRoutes = {
      0: '/driver/register/identity',
      1: '/driver/register/credentials',
      2: '/driver/register/bank',
      3: '/driver/register/safety',
      4: '/driver/register/training',
    };
    navigate(stepRoutes[driver.onboardingStep] || '/driver/register/credentials', { replace: true });
    return;
  }

  navigate('/driver/register/approval', { replace: true });
}

export function navigateUserAfterAuth(navigate, user, needsPhone) {
  if (needsPhone || userNeedsPhone(user)) {
    navigate('/link-phone', { replace: true });
    return;
  }

  navigate('/user/home', { replace: true });
}
