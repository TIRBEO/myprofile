import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from './proxy';

/* The retired interruption page must answer every stale link — bookmarks,
   recorded traffic and old bundles still minting `?blocked=…&sig=…` — with
   the settings gate, and must never let the query's claims survive the hop. */
describe('proxy: retired /blocked', () => {
  it('redirects the signed hand-off link to /settings and drops its query', async () => {
    const request = new NextRequest(
      'https://myprofile.tirbeo.com/blocked?blocked=deletion_pending&eventId=b457-de3b-ce5c&reason=user_requested&until=2026-11-18T11%3A31%3A58.533Z&sig=u0sR4vcHEbMZFyPxs14XVm-txYCnbRvN',
    );
    const res = await proxy(request);
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get('location')!);
    expect(location.pathname).toBe('/settings');
    expect(location.search).toBe('');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('redirects a bare /blocked too, signed out', async () => {
    const res = await proxy(new NextRequest('https://myprofile.tirbeo.com/blocked'));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location')!).pathname).toBe('/settings');
  });

  it('does not swallow sibling paths that merely start with the word', async () => {
    // Signed out, `/blockedout` is gated like any page: off to the accounts
    // login, not the retired-page redirect.
    const res = await proxy(new NextRequest('https://myprofile.tirbeo.com/blockedout'));
    const location = new URL(res.headers.get('location')!);
    expect(location.hostname).toBe('accounts.tirbeo.com');
    expect(location.pathname).toBe('/login');
  });

  it('strips a hand-off query stitched onto a live page', async () => {
    const res = await proxy(
      new NextRequest('https://myprofile.tirbeo.com/settings?blocked=banned&sig=abc'),
    );
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get('location')!);
    expect(location.pathname).toBe('/settings');
    expect(location.search).toBe('');
  });
});
