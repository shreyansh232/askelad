'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { useAuth } from '@/hooks/useAuth';
import { getLoginUrl } from '@/lib/auth';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  const router = useRouter();
  const { isLoading, isLoggedIn } = useAuth();

  useEffect(() => {
    if (!isLoading && isLoggedIn) {
      router.replace('/');
    }
  }, [isLoading, isLoggedIn, router]);

  function handleGoogleLogin() {
    window.location.href = getLoginUrl();
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <span className="pointer-events-none fixed top-6 right-6 z-20 text-sm font-medium tracking-[0.22em] text-foreground/90 uppercase sm:top-8 sm:right-8">
        Askelad
      </span>

      <div className="grid min-h-screen lg:grid-cols-[1.08fr_0.92fr]">
        <section className="relative hidden overflow-hidden bg-[#141414] lg:block">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:88px_88px] opacity-20" />
            <div className="absolute inset-x-0 top-0 h-[22rem] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),rgba(255,255,255,0)_68%)]" />
            <div className="absolute left-1/2 top-1/2 h-[20rem] w-[20rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.05),rgba(255,255,255,0)_72%)] blur-3xl" />
          </div>

          <div className="relative flex min-h-screen flex-col px-14 py-9 lg:px-20">
            {/* Top nav */}
            <div className="flex items-center">
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-[10px] tracking-[0.18em] text-foreground/40 uppercase transition-colors hover:text-foreground/80"
              >
                <ArrowLeft className="size-3" />
                Back
              </Link>
            </div>

            {/* Hero — true vertical center */}
            <div className="flex flex-1 items-center">
              <div>
                <p className="text-[10px] tracking-[0.3em] text-foreground/30 uppercase mb-5">
                  Askelad · Founder OS
                </p>
                <h1 className="font-mono text-[clamp(2.8rem,4.8vw,4.2rem)] leading-[1.02] tracking-[-0.04em] text-foreground">
                  Your AI team,<br />minus the payroll.
                </h1>
                <p className="mt-7 max-w-[34ch] text-[0.97rem] leading-[1.9] text-foreground/44">
                  Finance, product, and growth — all working from the same context, with a cofounder layer keeping everything in sync.
                </p>
              </div>
            </div>

            {/* Bottom strip */}
            <div className="flex items-center gap-6 text-[10px] tracking-[0.18em] text-foreground/24 uppercase">
              <span>Finance</span>
              <span className="opacity-40">·</span>
              <span>Product</span>
              <span className="opacity-40">·</span>
              <span>Marketing</span>
              <span className="opacity-40">·</span>
              <span>Growth</span>
            </div>
          </div>
        </section>

        <section className="relative bg-[#1b1b1b]">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0))]" />

          <div className="relative flex min-h-screen items-center justify-center px-8 py-12">
            <div className="w-full max-w-[380px]">
              {/* Card */}
              <div className="rounded-[1.75rem] border border-white/[0.1] bg-white/[0.03] p-8 sm:p-9">
                <h2 className="mt-3 font-mono text-[1.6rem] leading-tight tracking-[-0.04em] text-foreground">
                  Sign in to Askelad
                </h2>
                <p className="mt-2 text-[0.875rem] leading-[1.75] text-foreground/46">
                  Your AI-powered founding team is waiting
                </p>

                <Button
                  type="button"
                  onClick={handleGoogleLogin}
                  className="mt-8 flex h-[52px] w-full items-center justify-center gap-3 rounded-[0.9rem] bg-white px-5 text-sm font-medium text-black transition-all hover:bg-white/90 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1b1b1b]"
                >
                  <GoogleMark />
                  Sign in with Google
                </Button>

                <div className="mt-6 flex justify-center items-center text-xs text-foreground/42">
                  By signing in, you agree to our terms of service
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-[18px] w-[18px]"
      fill="none"
    >
      <path
        d="M21.6 12.23c0-.72-.06-1.25-.19-1.81H12v3.44h5.53c-.11.86-.72 2.15-2.08 3.02l-.02.12 3 2.28.21.02c1.93-1.76 2.96-4.34 2.96-7.07Z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.7 0 4.96-.87 6.61-2.37l-3.15-2.42c-.84.57-1.98.96-3.46.96-2.64 0-4.88-1.72-5.69-4.1l-.12.01-3.12 2.37-.04.11A9.98 9.98 0 0 0 12 22Z"
        fill="#34A853"
      />
      <path
        d="M6.31 14.07A5.9 5.9 0 0 1 5.97 12c0-.72.13-1.42.34-2.07l-.01-.14-3.16-2.4-.1.05A9.82 9.82 0 0 0 2 12c0 1.61.39 3.14 1.04 4.56l3.27-2.49Z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.83c1.86 0 3.12.79 3.84 1.45l2.8-2.67C16.95 3.07 14.7 2 12 2a9.98 9.98 0 0 0-8.96 5.44l3.27 2.49c.82-2.38 3.06-4.1 5.69-4.1Z"
        fill="#EA4335"
      />
    </svg>
  );
}
