import { apiFetch } from './api';
import { clearAuthTokens, getAccessToken, storeAuthTokens } from './token-storage';

// ─── Types ──────────────────────────────────────────────────────────────────
// Mirrors backend's UserResponse (schemas/users.py)
export type UserType = 'free' | 'premium' | 'admin';

export interface User {
  id: string;
  email: string;
  name: string | null;
  picture_url: string | null;
  user_type: UserType;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

// ─── Actions ────────────────────────────────────────────────────────────────

/** URL the browser navigates to for Google OAuth login. */
export function getLoginUrl(): string {
  return `${API_BASE_URL}/auth/login`;
}

export async function getCurrentUser(): Promise<User> {
  const accessToken = getAccessToken();

  if (!accessToken) {
    throw new Error('Not authenticated');
  }

  return apiFetch<User>(
    '/auth/me',
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    true,
  );
}

export async function logout(): Promise<void> {
  const accessToken = getAccessToken();

  if (accessToken) {
    await apiFetch('/auth/logout', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  }

  clearAuthTokens();
  window.location.href = '/';
}

export function persistAuthTokensFromFragment(hash: string): boolean {
  const fragment = hash.startsWith('#') ? hash.slice(1) : hash;
  const params = new URLSearchParams(fragment);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');

  if (!accessToken || !refreshToken) {
    return false;
  }

  storeAuthTokens(accessToken, refreshToken);
  return true;
}
