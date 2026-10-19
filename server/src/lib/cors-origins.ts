/**
 * Origin allow-listing shared by the HTTP API (CORS) and Socket.IO.
 *
 * The allow-list is built from `CLIENT_URL` (single origin, kept for backwards
 * compatibility) plus the optional comma-separated `ALLOWED_ORIGINS`. `*` is
 * honoured inside an entry so preview deployments — which get a brand new URL
 * on every push — can be allowed, e.g. `https://my-app-*.vercel.app`.
 *
 * Entries are normalised before comparison because browsers never append a
 * trailing slash to an `Origin` header and origins are case-insensitive: an
 * unnoticed `https://app.example.com/` in an env var used to reject every
 * request with an opaque 500.
 */

/**
 * A standalone `*` is dropped rather than honoured: with `credentials: true`
 * it would let any site on the internet send credentialed requests.
 */
const WILDCARD_ONLY = '*';

/** Trims, strips trailing slashes and lowercases an origin or allow-list entry. */
export const normalizeOrigin = (origin: string): string =>
  origin.trim().replace(/\/+$/, '').toLowerCase();

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Turns an allow-list entry into an anchored matcher, mapping `*` onto `.*`. */
const toMatcher = (pattern: string): RegExp =>
  new RegExp(`^${escapeRegExp(pattern).replace(/\\\*/g, '.*')}$`);

/**
 * Builds the normalised, de-duplicated allow-list.
 *
 * @param clientUrl - value of `CLIENT_URL`
 * @param allowedOrigins - raw value of `ALLOWED_ORIGINS` (comma-separated, optional)
 */
export const resolveAllowedOrigins = (
  clientUrl?: string,
  allowedOrigins?: string
): string[] => {
  const entries = [clientUrl, ...(allowedOrigins ?? '').split(',')]
    .map((entry) => (entry ?? '').trim())
    .filter((entry) => entry.length > 0 && entry !== WILDCARD_ONLY)
    .map(normalizeOrigin);

  return [...new Set(entries)];
};

/**
 * Checks a request `Origin` against a resolved allow-list.
 *
 * @param origin - raw `Origin` header (or Socket.IO handshake origin)
 * @param allowedOrigins - result of `resolveAllowedOrigins`
 */
export const isOriginAllowed = (
  origin: string,
  allowedOrigins: readonly string[]
): boolean => {
  if (!Array.isArray(allowedOrigins) || allowedOrigins.length === 0) {
    return false;
  }

  const normalizedOrigin = normalizeOrigin(origin);

  return allowedOrigins.some((pattern) =>
    pattern.includes('*')
      ? toMatcher(pattern).test(normalizedOrigin)
      : pattern === normalizedOrigin
  );
};
