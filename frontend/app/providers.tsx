// app/providers.tsx
// ─────────────────────────────────────────────────────────────────────────────
// This file creates a "QueryClientProvider" — a wrapper that gives every
// component in your app access to TanStack Query's caching & refetching.
//
// Analogy: TanStack Query is like a smart assistant that sits between
// your components and the API.  Instead of every component calling
// fetch() independently, they all ask this assistant.  The assistant
// remembers answers (cache), knows when to re-ask (stale time), and
// keeps everyone in sync.
//
// 'use client' is required because TanStack Query uses React state
// internally, and Next.js App Router defaults to Server Components.
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

export default function Providers({ children }: { children: ReactNode }) {
  // We create the QueryClient inside useState so it's created once
  // per browser tab, not re-created on every render.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // How long cached data is considered "fresh" (5 minutes).
            // During this window, TanStack Query won't re-fetch.
            staleTime: 5 * 60 * 1000,
            // Don't retry failed queries aggressively
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
