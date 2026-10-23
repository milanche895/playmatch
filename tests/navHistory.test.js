const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeHref,
  markNav,
  syncNavStack,
  getPreviousHref,
  resetNavHistory,
} = require('../src/lib/navHistory');

test('back stack follows in-app visits and ignores a repeat sync', () => {
  resetNavHistory();
  syncNavStack('/');
  assert.equal(getPreviousHref(), null);

  markNav('push');
  syncNavStack('/matches/1');
  assert.equal(getPreviousHref(), '/');

  syncNavStack('/matches/1');
  assert.equal(getPreviousHref(), '/');

  markNav('back');
  syncNavStack('/');
  assert.equal(getPreviousHref(), null);
});

test('replace keeps the page under the current one', () => {
  resetNavHistory();
  syncNavStack('/profil');
  markNav('replace');
  syncNavStack('/omiljene-igre');
  assert.equal(getPreviousHref(), null);

  markNav('push');
  syncNavStack('/profil');
  markNav('push');
  syncNavStack('/notification-settings/postavke');
  markNav('replace');
  syncNavStack('/notification-settings/postavke?saved=1');
  assert.equal(getPreviousHref(), '/profil');
});

test('browser back to the previous entry pops, a new visit to an older page pushes', () => {
  resetNavHistory();
  syncNavStack('/');
  markNav('push');
  syncNavStack('/profil');
  markNav('push');
  syncNavStack('/moji-igraci');

  syncNavStack('/profil');
  assert.equal(getPreviousHref(), '/');

  markNav('push');
  syncNavStack('/');
  assert.equal(getPreviousHref(), '/profil');
});

test('replace waits until the address actually changes', () => {
  resetNavHistory();
  markNav('replace', '/login?from=%2Fcreate');
  syncNavStack('/create');
  assert.equal(getPreviousHref(), null);
  syncNavStack('/login?from=%2Fcreate');
  assert.equal(getPreviousHref(), null);
});

test('normalizeHref drops the hash and keeps the query', () => {
  assert.equal(normalizeHref('/profil?sheet=invite#top'), '/profil?sheet=invite');
  assert.equal(normalizeHref(''), '/');
});
