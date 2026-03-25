// hooks/useAuth.ts
// ─────────────────────────────────────────────────────────────────────────────
// The central React hook for authentication state.
//
// Any component can call:
//   const { user, isLoading, isLoggedIn, handleLogout } = useAuth();
//
// TanStack Query handles:
//   - Caching the user data so we don't hit /auth/me on every render
//   - Automatically refetching when the window gains focus
//   - Deduplicating requests if multiple components mount at once
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getCurrentUser, logout, type User } from '@/lib/auth';

/** Unique cache key — TanStack Query uses this to store & find the data. */
const AUTH_QUERY_KEY = ['auth', 'me'] as const;

export function useAuth() {
  const queryClient = useQueryClient();

  const {
    data: user,        // the User object (or undefined while loading)
    isLoading,         // true while the first fetch is in progress
    isError,           // true if /auth/me returned an error (not logged in)
  } = useQuery<User>({
    queryKey: AUTH_QUERY_KEY,
    queryFn: getCurrentUser,
    retry: false,               // don't retry — a 401 means "not logged in"
    staleTime: 5 * 60 * 1000,  // cache for 5 minutes
  });

  const isLoggedIn = !!user && !isError;

  async function handleLogout() {
    // Clear the cached user data immediately (optimistic)
    queryClient.setQueryData(AUTH_QUERY_KEY, null);
    // Then hit the backend to actually end the session
    await logout();
  }

  return { user, isLoading, isLoggedIn, handleLogout };
}
