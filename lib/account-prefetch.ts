/**
 * The account-state read, started by the document rather than by the bundle.
 *
 * The settings gate will not paint the dashboard until the brain has answered
 * `/api/user/account-state` — that is what keeps a closed account from seeing
 * even one frame of its own shell. Asking for that answer from a `useEffect`
 * means the wait is *HTML download + bundle download + parse + hydrate + round
 * trip*, and the reader spends it watching a spinner they cannot act on.
 *
 * So the layout fires the read as it fires the theme and language boot scripts:
 * the cookie is already on the request, the round trip overlaps the bundle, and
 * `loadAccountState()` adopts the answer instead of starting a second one
 * (see `takePrefetch` in `lib/account-lifecycle.ts`).
 *
 * It is a read of the account's own state over the account's own cookie, and
 * nothing is signed or decided here: the brain still refuses every door a
 * closed account has no business reaching, whatever this returns. A page that
 * gets a wrong or missing answer simply falls back to asking for itself.
 */
export const ACCOUNT_STATE_BOOT = `
(function () {
  try {
    if (typeof fetch !== 'function') return;
    // Only the settings shell waits on this answer. /login and /oauth-complete
    // are signed-out by definition, so asking there would spend a hop on a 401.
    if (location.pathname !== '/settings' && location.pathname.indexOf('/settings/') !== 0) return;
    var read = fetch('/api/user/account-state', {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { accept: 'application/json' }
    }).then(function (res) {
      return res && res.ok ? res.json() : null;
    }).catch(function () { return null; });
    // Handed over as a promise: the store awaits it and takes the slot, so one
    // document costs exactly one read of the account's state.
    window.__tirbeoAccountState = read;
  } catch (e) { /* the page will ask for itself */ }
})();
`;
