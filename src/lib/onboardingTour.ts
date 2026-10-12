const PENDING_KEY = 'plejko:onboarding-tour-pending';
const DONE_PREFIX = 'plejko:onboarding-tour-done:';

export const ONBOARDING_TOUR_FINISHED_EVENT = 'plejko:onboarding-tour-finished';

export function markOnboardingTourPending() {
  try {
    localStorage.setItem(PENDING_KEY, '1');
  } catch {
    // private mode
  }
}

export function isOnboardingTourPending(): boolean {
  try {
    return localStorage.getItem(PENDING_KEY) === '1';
  } catch {
    return false;
  }
}

export function isOnboardingTourDone(userId: string): boolean {
  try {
    return localStorage.getItem(`${DONE_PREFIX}${userId}`) === '1';
  } catch {
    return false;
  }
}

export function shouldStartOnboardingTour(userId: string): boolean {
  return isOnboardingTourPending() && !isOnboardingTourDone(userId);
}

export function completeOnboardingTour(userId: string) {
  try {
    localStorage.setItem(`${DONE_PREFIX}${userId}`, '1');
    localStorage.removeItem(PENDING_KEY);
  } catch {
    // private mode
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(ONBOARDING_TOUR_FINISHED_EVENT));
  }
}

const SKIP_PATHS = new Set([
  '/welcome',
  '/register',
  '/login',
  '/auth/callback',
  '/verify-email',
]);

export function isOnboardingTourPath(pathname: string): boolean {
  return !SKIP_PATHS.has(pathname);
}
