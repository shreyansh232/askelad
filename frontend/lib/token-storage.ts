'use client';

const ACCESS_TOKEN_COOKIE = 'askelad_access_token';
const REFRESH_TOKEN_COOKIE = 'askelad_refresh_token';

function getCookieValue(name: string): string | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const match = document.cookie.match(
    new RegExp(`(?:^|; )${name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1')}=([^;]*)`),
  );

  return match ? decodeURIComponent(match[1]) : null;
}

function setCookieValue(name: string, value: string, maxAge: number): void {
  if (typeof document === 'undefined') {
    return;
  }

  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

function clearCookieValue(name: string): void {
  if (typeof document === 'undefined') {
    return;
  }

  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function getAccessToken(): string | null {
  return getCookieValue(ACCESS_TOKEN_COOKIE);
}

export function getRefreshToken(): string | null {
  return getCookieValue(REFRESH_TOKEN_COOKIE);
}

export function storeAuthTokens(accessToken: string, refreshToken: string): void {
  setCookieValue(ACCESS_TOKEN_COOKIE, accessToken, 60 * 60);
  setCookieValue(REFRESH_TOKEN_COOKIE, refreshToken, 60 * 60 * 24 * 30);
}

export function clearAuthTokens(): void {
  clearCookieValue(ACCESS_TOKEN_COOKIE);
  clearCookieValue(REFRESH_TOKEN_COOKIE);
}
