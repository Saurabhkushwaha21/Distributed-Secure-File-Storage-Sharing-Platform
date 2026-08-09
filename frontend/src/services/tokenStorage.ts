/**
 * Token storage strategy:
 * - Access token: kept in memory only (module-level variable). Never
 *   touches localStorage/sessionStorage, so it can't be read by an XSS
 *   payload that runs later or by a browser extension scanning storage.
 * - Refresh token: persisted in localStorage (or sessionStorage for
 *   non-"remember me" sessions) so a page refresh doesn't force a full
 *   re-login. This is a pragmatic trade-off for an SPA without a
 *   same-site backend session cookie; the ideal production setup issues
 *   the refresh token as an httpOnly cookie instead, which this client
 *   would need the backend to support.
 */
let inMemoryAccessToken: string | null = null;

const REFRESH_TOKEN_KEY = "cloudvault_refresh_token";
const REMEMBER_ME_KEY = "cloudvault_remember_me";

export function setAccessToken(token: string | null) {
  inMemoryAccessToken = token;
}

export function getAccessToken(): string | null {
  return inMemoryAccessToken;
}

export function setRefreshToken(token: string, rememberMe: boolean) {
  const store = rememberMe ? localStorage : sessionStorage;
  store.setItem(REFRESH_TOKEN_KEY, token);
  localStorage.setItem(REMEMBER_ME_KEY, rememberMe ? "1" : "0");
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY) ?? sessionStorage.getItem(REFRESH_TOKEN_KEY);
}

export function clearTokens() {
  inMemoryAccessToken = null;
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(REMEMBER_ME_KEY);
}
