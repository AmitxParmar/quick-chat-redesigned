import { describe, it, expect } from '@jest/globals';
import {
  isOriginAllowed,
  normalizeOrigin,
  resolveAllowedOrigins,
} from '@/lib/cors-origins';

describe('normalizeOrigin', () => {
  it('strips trailing slashes and surrounding whitespace', () => {
    expect(normalizeOrigin('  https://app.example.com//  ')).toBe(
      'https://app.example.com'
    );
  });

  it('lowercases so casing differences cannot break the match', () => {
    expect(normalizeOrigin('HTTPS://App.Example.COM')).toBe(
      'https://app.example.com'
    );
  });

  it('leaves a bare origin untouched', () => {
    expect(normalizeOrigin('https://app.example.com')).toBe(
      'https://app.example.com'
    );
  });
});

describe('resolveAllowedOrigins', () => {
  it('includes CLIENT_URL and every comma-separated ALLOWED_ORIGINS entry', () => {
    expect(
      resolveAllowedOrigins(
        'https://app.example.com',
        'https://staging.example.com, https://preview.example.com'
      )
    ).toEqual([
      'https://app.example.com',
      'https://staging.example.com',
      'https://preview.example.com',
    ]);
  });

  it('normalises both sources so a trailing slash in an env var is harmless', () => {
    // This is the exact misconfiguration that made every login fail.
    const origins = resolveAllowedOrigins(
      'https://app.example.com/',
      undefined
    );
    expect(origins).toEqual(['https://app.example.com']);
    expect(isOriginAllowed('https://app.example.com', origins)).toBe(true);
  });

  it('de-duplicates repeated entries', () => {
    expect(
      resolveAllowedOrigins(
        'https://app.example.com',
        'https://APP.example.com/'
      )
    ).toEqual(['https://app.example.com']);
  });

  it('ignores blanks, stray commas and a standalone wildcard', () => {
    // A bare "*" would allow any site to send credentialed requests.
    expect(resolveAllowedOrigins('', ' , *, ,')).toEqual([]);
  });

  it('returns an empty list when nothing is configured', () => {
    expect(resolveAllowedOrigins(undefined, undefined)).toEqual([]);
  });
});

describe('isOriginAllowed', () => {
  const origins = resolveAllowedOrigins(
    'https://quick-chat-redesigned-five.vercel.app',
    'https://quick-chat-redesigned-*.vercel.app, https://localhost:3000'
  );

  it('allows the exact CLIENT_URL', () => {
    expect(
      isOriginAllowed('https://quick-chat-redesigned-five.vercel.app', origins)
    ).toBe(true);
  });

  it('allows per-deployment preview URLs via the wildcard entry', () => {
    // Preview deployments get a fresh URL on every push, so an exact-match-only
    // allow-list breaks them.
    expect(
      isOriginAllowed(
        'https://quick-chat-redesigned-9tsvzwvej-amitx.vercel.app',
        origins
      )
    ).toBe(true);
  });

  it('rejects an unrelated origin', () => {
    expect(isOriginAllowed('https://evil.example.com', origins)).toBe(false);
  });

  it('does not let a wildcard escape its own host', () => {
    expect(
      isOriginAllowed(
        'https://quick-chat-redesigned-x.vercel.app.evil.com',
        origins
      )
    ).toBe(false);
  });

  it('rejects everything when the allow-list is empty', () => {
    expect(isOriginAllowed('https://app.example.com', [])).toBe(false);
  });

  it('rejects everything when the allow-list is missing', () => {
    // Guards against an unmocked/undefined environment in tests and at runtime.
    expect(
      isOriginAllowed(
        'https://app.example.com',
        undefined as unknown as string[]
      )
    ).toBe(false);
  });

  it('tolerates a trailing slash on the incoming origin', () => {
    expect(
      isOriginAllowed('https://quick-chat-redesigned-five.vercel.app/', origins)
    ).toBe(true);
  });
});
