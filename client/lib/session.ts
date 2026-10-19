/**
 * First-party session hint.
 *
 * The API lives on a different site (onrender.com) from the app (vercel.app),
 * so the HttpOnly auth cookies it sets belong to the API's origin and are
 * invisible to this app's middleware (`middleware.ts` can only read cookies
 * for its own origin).
 *
 * This lightweight, non-sensitive flag is written by the browser on the app's
 * own origin after a successful login/register. Middleware uses it purely for
 * navigation (route gating, redirecting away from /login). It grants no access
 * on its own — every API request is still authorised by the HttpOnly tokens.
 */

export const SESSION_HINT_COOKIE = "session_hint";

/** Matches the refresh-token lifetime (7 days). */
const MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export function markSessionActive(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${SESSION_HINT_COOKIE}=1; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax`;
}

export function clearSessionMark(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${SESSION_HINT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}
