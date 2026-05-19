export const DRIVER_ONBOARDING_STEPS = [
  'Identity',
  'Credentials',
  'Bank',
  'Safety',
  'Verification',
  'Training',
];

export const DRIVER_ONBOARDING_ROUTES = {
  0: '/driver/register/identity',
  1: '/driver/register/credentials',
  2: '/driver/register/bank',
  3: '/driver/register/safety',
  4: '/driver/register/verification',
  5: '/driver/register/training',
};

export const LIVE_VERIFICATION_MIN_SECONDS = 15;
export const LIVE_VERIFICATION_MAX_SECONDS = 120;

const REVIEW_STATUSES = ['under_review', 'approved', 'rejected', 'suspended'];

export function isLegacySubmittedDriver(driver) {
  if (!driver) return false;
  return (
    driver.onboardingStep === 5 &&
    REVIEW_STATUSES.includes(driver.approvalStatus) &&
    !driver.liveVerificationVideo?.videoUrl
  );
}

export function isApplicationSubmitted(driver) {
  if (!driver) return false;
  if (driver.approvalStatus === 'rejected') return false;
  if (driver.onboardingStep >= 6 && driver.approvalStatus === 'under_review') return true;
  return isLegacySubmittedDriver(driver);
}

export function canUpdateRejectedApplication(driver) {
  return driver?.approvalStatus === 'rejected';
}

export function hasCompletedLiveVerification(driver) {
  if (!driver) return false;
  if (driver.liveVerificationVideo?.videoUrl) return true;
  if (isLegacySubmittedDriver(driver)) return true;
  return driver.onboardingStep >= 5;
}
