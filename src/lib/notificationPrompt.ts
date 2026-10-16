import api from './api';

const PROMPT_KEY = 'plejko:prompt-notifications';
const PROMPT_ARMED_KEY = 'plejko:prompt-notifications-armed';
const LOGIN_PROMPT_KEY = 'plejko:prompt-notifications-login';

export function markPromptNotificationsAfterRegister() {
  try {
    if (sessionStorage.getItem(PROMPT_ARMED_KEY) === '1') return;
    sessionStorage.setItem(PROMPT_KEY, '1');
    sessionStorage.setItem(PROMPT_ARMED_KEY, '1');
  } catch {
    // sessionStorage may be unavailable in some private-mode browsers
  }
}

export function clearPromptNotificationsAfterRegister() {
  try {
    sessionStorage.removeItem(PROMPT_KEY);
  } catch {
    // ignore
  }
}

export function hasPromptFlag(): boolean {
  try {
    return sessionStorage.getItem(PROMPT_KEY) === '1';
  } catch {
    return false;
  }
}

/** Ask again on this login. Cleared when the player subscribes or chooses "Kasnije". */
export function markPromptNotificationsOnLogin() {
  try {
    sessionStorage.setItem(LOGIN_PROMPT_KEY, '1');
  } catch {
    // sessionStorage may be unavailable in some private-mode browsers
  }
}

export function clearLoginNotificationPrompt() {
  try {
    sessionStorage.removeItem(LOGIN_PROMPT_KEY);
  } catch {
    // ignore
  }
}

export function hasLoginPromptFlag(): boolean {
  try {
    return sessionStorage.getItem(LOGIN_PROMPT_KEY) === '1';
  } catch {
    return false;
  }
}

export async function isPushActivated(): Promise<boolean> {
  const res = await api.get('/api/players/push-subscription/status');
  return Boolean(res.data?.subscribed);
}
