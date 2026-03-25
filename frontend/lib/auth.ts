import { apiFetch } from './api';

// ─── Types ──────────────────────────────────────────────────────────────────
// Mirrors backend's UserResponse (schemas/users.py)
export interface User {
  id: string;
  email: string;
  name: string | null;
  picture_url: string | null;
}

// ─── Raw backend origin (no /api suffix) ────────────────────────────────────
// Used only for browser redirects (login) — NOT for apiFetch calls.
const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ─── Actions ────────────────────────────────────────────────────────────────

/** URL the browser navigates to for Google OAuth login. */
export function getLoginUrl(): string {
  return `${API_ORIGIN}/auth/login`;
}

/** Ask the backend "who am I?" (reads access_token cookie). */
export async function getCurrentUser(): Promise<User> {
  // skipRefresh = true → if 401, just throw (user isn't logged in).
  // Without this, apiFetch would try /auth/refresh → also 401 → infinite loop.
  return apiFetch<User>('/auth/me', {}, true);
}

/** End the session — backend deletes refresh token + clears cookies. */
export async function logout(): Promise<void> {
  await apiFetch('/auth/logout', { method: 'POST' });
  window.location.href = '/';
}