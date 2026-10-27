/**
 * Where a finished sign-in on this page may drive the browser.
 *
 * Two bugs this pins, both in the same validator and both in opposite
 * directions:
 *   1. `parentDomain()` used to fall back to "the last two labels of wherever
 *      we are" — so on a preview deployment (`*.vercel.app`) any
 *      `https://evil.vercel.app` counted as a Tirbeo destination.
 *   2. the site-relative branch rejected *every* path starting with `/`, which
 *      silently dropped legitimate deep links like `/settings/devices`.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';

const { isSafeRedirectTarget, safeRedirectTarget } = await import('@/lib/redirect-target');

function onHost(host: string, protocol = 'https:') {
  vi.stubGlobal('window', { location: { hostname: host, protocol, origin: `${protocol}//${host}` } });
}

afterEach(() => vi.unstubAllGlobals());

describe('post-auth redirect allow-list', () => {
  it('refuses hosts that only spell themselves as Tirbeo', () => {
    onHost('myprofile.tirbeo.com');
    for (const evil of [
      'https://tirbeo.com.evil.example/',
      'https://myprofile.tirbeo.com@evil.example/settings',
      'https://evil-tirbeo.com/',
      'https://tirbeo.co/settings',
      'https://evil.example/?next=https://myprofile.tirbeo.com',
      'javascript:alert(1)//tirbeo.com',
      'http://myprofile.tirbeo.com/settings',
    ]) {
      expect(isSafeRedirectTarget(evil), evil).toBe(false);
    }
  });

  it('a preview deployment cannot widen the allow-list to its own host suffix', () => {
    onHost('myprofile-git-demo.vercel.app');
    expect(isSafeRedirectTarget('https://evil.vercel.app/payout')).toBe(false);
    expect(isSafeRedirectTarget('https://tirbeo.com/pricing')).toBe(false);
  });

  it('keeps same-origin paths, including nested ones', () => {
    onHost('myprofile.tirbeo.com');
    expect(isSafeRedirectTarget('/settings')).toBe(true);
    expect(isSafeRedirectTarget('/settings/devices')).toBe(true);
  });

  it('refuses the net-relative spellings, tab-smuggled ones included', () => {
    onHost('myprofile.tirbeo.com');
    for (const smuggled of ['//evil.example/', '/\\evil.example', '/\t/evil.example', '/\n/evil.example']) {
      expect(isSafeRedirectTarget(smuggled), JSON.stringify(smuggled)).toBe(false);
    }
  });

  it('keeps real Tirbeo targets', () => {
    onHost('myprofile.tirbeo.com');
    expect(isSafeRedirectTarget('https://myprofile.tirbeo.com/settings')).toBe(true);
    expect(isSafeRedirectTarget('https://tirbeo.com/pricing')).toBe(true);
  });

  it('trusts loopback only when we are running on loopback', () => {
    onHost('localhost', 'http:');
    expect(isSafeRedirectTarget('http://localhost:3005/settings')).toBe(true);
    onHost('myprofile.tirbeo.com');
    expect(isSafeRedirectTarget('http://localhost:3005/settings')).toBe(false);
  });

  it('falls back instead of navigating at anything it cannot vouch for', () => {
    onHost('myprofile.tirbeo.com');
    expect(safeRedirectTarget('https://hackerwebsite.com', '/settings')).toBe('/settings');
    expect(safeRedirectTarget('', '/settings')).toBe('/settings');
    expect(safeRedirectTarget(null, '/settings')).toBe('/settings');
    expect(safeRedirectTarget('/settings/devices', '/settings')).toBe('/settings/devices');
  });
});
