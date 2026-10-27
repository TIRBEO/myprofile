import { NextResponse } from "next/server";

/**
 * Refuse a state-changing call that a browser says came from somewhere else.
 *
 * The bridge forwards the visitor's own session cookie, and the account service
 * asks for a double-submit token that matches the `__csrf` cookie. Both of those
 * cookies are readable by *every* Tirbeo subdomain — they are shared, that is how
 * one sign-in works across the fleet — so a page on another subdomain can present
 * the pair as if it were this app. `Sec-Fetch-Site` is what the browser itself
 * says about who asked, and a page cannot set it, so this is the one signal that
 * separates the settings screens from their siblings.
 *
 * A request with no `Sec-Fetch-Site` header at all is let through: that is a
 * non-browser caller (curl, a server-to-server job), which carries no ambient
 * session and so has nothing to forge.
 */
export function refuseCrossSiteWrite(request: Request): NextResponse | null {
  const site = request.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') {
    return NextResponse.json(
      { error: 'This request must come from the account screens themselves.', code: 'cross_site_request' },
      { status: 403 },
    );
  }
  const origin = request.headers.get('origin');
  if (origin) {
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      return NextResponse.json({ error: 'Unreadable origin.', code: 'bad_origin' }, { status: 403 });
    }
    if (originHost !== new URL(request.url).host) {
      return NextResponse.json(
        { error: 'This request must come from the account screens themselves.', code: 'cross_site_request' },
        { status: 403 },
      );
    }
  }
  return null;
}
