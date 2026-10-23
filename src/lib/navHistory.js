/** In-app history. Browser history.length also counts pages outside Plejko, so back uses this stack. */

const stack = [];
let pending = null;
let pendingToken = null;

function normalizeHref(href) {
  const raw = String(href || '/');
  const hash = raw.indexOf('#');
  const noHash = hash >= 0 ? raw.slice(0, hash) : raw;
  const q = noHash.indexOf('?');
  const path = (q === -1 ? noHash : noHash.slice(0, q)) || '/';
  const query = q === -1 ? '' : noHash.slice(q + 1);
  const qs = new URLSearchParams(query).toString();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return qs ? `${cleanPath}?${qs}` : cleanPath;
}

function markNav(action, href) {
  pending = { action, href: href ? normalizeHref(href) : null };
  const token = {};
  pendingToken = token;
  setTimeout(() => {
    if (pendingToken === token) {
      pending = null;
      pendingToken = null;
    }
  }, 2000);
}

function syncNavStack(href) {
  // A click can be recorded before the address bar updates. Keep that intent
  // until the target page is actually shown.
  if (pending && pending.href && pending.href !== href) {
    if (stack[stack.length - 1] !== href) {
      if (stack.length === 0 || pending.action === 'push') stack.push(href);
      else stack[stack.length - 1] = href;
    }
    return;
  }

  const action = pending ? pending.action : null;
  pending = null;
  pendingToken = null;

  const top = stack[stack.length - 1];
  if (action === 'replace') {
    if (stack.length === 0) stack.push(href);
    else stack[stack.length - 1] = href;
    return;
  }

  if (top === href && action !== 'back') return;

  const movingBack =
    action === 'back' || (action !== 'push' && stack.length >= 2 && stack[stack.length - 2] === href);

  if (movingBack) {
    if (stack.length >= 2 && stack[stack.length - 2] === href) {
      stack.pop();
      return;
    }
    const idx = stack.lastIndexOf(href);
    if (idx >= 0) stack.length = idx + 1;
    else stack.push(href);
    return;
  }

  stack.push(href);
}

function getPreviousHref() {
  if (stack.length < 2) return null;
  return stack[stack.length - 2];
}

function resetNavHistory() {
  stack.length = 0;
  pending = null;
  pendingToken = null;
}

module.exports = {
  normalizeHref,
  markNav,
  syncNavStack,
  getPreviousHref,
  resetNavHistory,
};
