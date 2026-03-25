'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const error = searchParams.get('error');

    if (error) {
      // Brief delay so the user sees the error, then send back to landing
      setTimeout(() => {
        router.replace('/');
      }, 2500);
      return;
    }

    // Success — cookies were already set by the backend redirect.
    // Navigate to the main app.
    router.replace('/');
  }, [router, searchParams]);

  const error = searchParams.get('error');

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground">
      <div className="text-center">
        {error ? (
          <>
            <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/15">
              <span className="text-xl text-destructive">✕</span>
            </div>
            <h2 className="text-lg font-medium">Sign in failed</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {error === 'access_denied'
                ? 'You cancelled the sign in.'
                : 'Something went wrong. Please try again.'}
            </p>
            <p className="mt-4 text-xs text-muted-foreground/60">
              Redirecting you back…
            </p>
          </>
        ) : (
          <>
            <div className="mx-auto mb-6 h-8 w-8 animate-spin rounded-full border-[3px] border-foreground/20 border-t-foreground" />
            <h2 className="text-lg font-medium">Completing your sign in</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              You&apos;ll be redirected shortly…
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// Next.js App Router requires useSearchParams() to be wrapped in Suspense
export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-foreground/20 border-t-foreground" />
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}