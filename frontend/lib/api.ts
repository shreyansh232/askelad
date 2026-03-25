const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

/**
 * Central fetch wrapper. Sends cookies automatically.
 *
 * @param path        — API path, e.g. '/auth/me' (BASE_URL already has /api)
 * @param options     — standard RequestInit (method, body, headers…)
 * @param skipRefresh — if true, do NOT attempt a silent token refresh on 401.
 *                      Used by /auth/me so it doesn't loop forever when the
 *                      user simply isn't logged in.
 */
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  skipRefresh = false
): Promise<T> {
  const url = `${BASE_URL}${path}`;

  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  // ─── HANDLE 401 ──────────────────────────────────────────────────────────
  if (response.status === 401) {
    // If skipRefresh is true (e.g. /auth/me), just throw immediately.
    // This lets useAuth()'s useQuery see isError = true → "not logged in".
    if (skipRefresh) {
      throw new Error('Not authenticated');
    }

    // Otherwise, try to silently refresh the access token.
    const refreshResponse = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });

    if (refreshResponse.ok) {
      // Refresh worked — retry the original request once.
      const retryResponse = await fetch(url, {
        ...options,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!retryResponse.ok) {
        throw new Error(`API error: ${retryResponse.status}`);
      }
      return retryResponse.json() as Promise<T>;
    }

    // Refresh also failed → session is dead. Throw (don't redirect).
    // The calling component can decide what to do (show login, etc.).
    throw new Error('Session expired');
  }

  // ─── OTHER ERRORS ────────────────────────────────────────────────────────
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `API error: ${response.status}`);
  }

  return response.json() as Promise<T>;
}