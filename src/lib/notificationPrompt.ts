import api from './api';

const PROMPT_KEY = 'plejko:prompt-notifications';
const PROMPT_ARMED_KEY = 'plejko:prompt-notifications-armed';
const LOGIN_PROMPT_KEY = 'plejko:prompt-notifications-login';
const BEFORE_CREATE_KEY = 'plejko:prompt-notifications-before-create';

export const PROMPT_BEFORE_CREATE_EVENT = 'plejko:prompt-notifications-before-create';

/** Show the notification prompt now, then continue to match creation. */
export function requestNotificationsBeforeCreate() {
  try {
    sessionStorage.setItem(PROMPT_KEY, '1');
    sessionStorage.setItem(PROMPT_ARMED_KEY, '1');
    sessionStorage.setItem(BEFORE_CREATE_KEY, '1');
  } catch {
    // sessionStorage may be unavailable in some private-mode browsers
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(PROMPT_BEFORE_CREATE_EVENT));
  }
}

export function isNotificationsBeforeCreate(): boolean {
  try {
    return sessionStorage.getItem(BEFORE_CREATE_KEY) === '1';
  } catch {
    return false;
  }
}

export function clearNotificationsBeforeCreate() {
  try {
    sessionStorage.removeItem(BEFORE_CREATE_KEY);
  } catch {
    // ignore
  }
}

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
