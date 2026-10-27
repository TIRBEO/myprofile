/**
 * Where this page is allowed to send the browser.
 *
 * Post-authentication screens are the classic open-redirect target: the link
 * arrives with the user's trust already spent, so `?redirect_to=https://evil`
 * reads like the site's own next step. Anything that ends up in
 * `window.location.href` — a URL parameter, or a `redirect_to` handed back by
 * the API — goes through here first.
 *
 * The rule matches the accounts app's allowlist: same-origin paths, and https
 * URLs on the current Tirbeo parent domain (or the dev origin). Everything
 * else falls back to a destination the page knows.
 */

/**
 * `myprofile.tirbeo.com` → `tirbeo.com`; anything else has no parent.
 *
 * Deliberately does not fall back to "the last two labels of the current host".
 * On a preview deployment (`myprofile-git-foo.vercel.app`) that guess would
 * hand back `vercel.app` and make *any* `https://evil.vercel.app` a legitimate
 * post-auth destination — the deployment's own hostname would widen the
 * allowlist it is supposed to enforce.
 */
function parentDomain(): string | null {
  if (typeof window === 'undefined') return null;
  const match = window.location.hostname.match(/(?:^|\.)(tirbeo\.(?:com|app))$/i);
  return match ? match[1].toLowerCase() : null;
}

function isDevOrigin(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

export function isSafeRedirectTarget(raw: string): boolean {
  const value = (raw || '').trim();
  if (!value) return false;
  // A site-relative path. `//host` and `/\host` are both net-relative, and the
  // backslash form is the one a plain `startsWith('//')` misses — but the
  // WHATWG parser also strips tabs and newlines from anywhere in the URL, so
  // `/\t/evil.example` becomes `//evil.example` only once the browser looks at
  // it. Guessing from the prefix would then either reject every real path or
  // accept that smuggle; resolving against our own origin answers both.
  if (value.startsWith('/')) {
    if (/^\/[/\\]/.test(value)) return false;
    if (typeof window === 'undefined') return false;
    try {
      return new URL(value, window.location.origin).origin === window.location.origin;
    } catch {
      return false;
    }
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.username || url.password) return false;
  if (url.protocol !== 'https:' && !(isDevOrigin() && url.protocol === 'http:')) return false;
  const parent = parentDomain();
  const host = url.hostname.toLowerCase();
  if (isDevOrigin() && (host === 'localhost' || host === '127.0.0.1')) return true;
  if (!parent) return false;
  return host === parent || host.endsWith(`.${parent}`);
}

/** `raw` when it is a destination we may drive to, otherwise `fallback`. */
export function safeRedirectTarget(raw: string | null | undefined, fallback: string): string {
  const value = (raw || '').trim();
  if (!value) return fallback;
  return isSafeRedirectTarget(value) ? value : fallback;
}
