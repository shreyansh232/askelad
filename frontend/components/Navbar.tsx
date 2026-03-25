'use client';

import { useState, useRef, useEffect } from 'react';
import { ArrowUpRight, LogOut } from 'lucide-react';
import Image from 'next/image';

import { Button } from '@/components/ui/button';
import { getLoginUrl } from '@/lib/auth';
import { useAuth } from '@/hooks/useAuth';

export default function Navbar() {
  const { user, isLoading, isLoggedIn, handleLogout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function handleLogin() {
    window.location.href = getLoginUrl();
  }

  return (
    <header className="fixed top-8 left-1/2 z-50 -translate-x-1/2">
      <nav className="flex h-[4.5rem] w-[min(96vw,1080px)] items-center justify-between rounded-full border border-border/70 bg-card/55 px-5 py-4 backdrop-blur-xl sm:px-7">
        <div className="flex items-center">
          <span className="text-sm font-medium tracking-[0.18em] text-foreground/90 uppercase">
            Askelad
          </span>
        </div>

        <div className="hidden items-center gap-1 sm:flex">
          <a
            href="#how-it-works"
            className="rounded-[1rem] px-4 py-2 text-sm text-foreground/56 transition-colors hover:text-foreground"
          >
            How it works
          </a>
          <a
            href="#faqs"
            className="rounded-[1rem] px-4 py-2 text-sm text-foreground/56 transition-colors hover:text-foreground"
          >
            FAQs
          </a>
          <a
            href="https://github.com/shreyansh232/askelad"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-[1rem] px-4 py-2 text-sm text-foreground/56 transition-colors hover:text-foreground"
          >
            GitHub
            <ArrowUpRight className="size-3.5" />
          </a>
        </div>

        {/* ─── Auth section ─── */}
        <div className="flex items-center">
          {isLoading ? (
            // Skeleton while checking auth status
            <div className="h-9 w-9 animate-pulse rounded-full bg-muted" />
          ) : isLoggedIn && user ? (
            // Logged-in: profile photo with dropdown
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((prev) => !prev)}
                className="flex items-center rounded-full ring-2 ring-transparent transition-all hover:ring-foreground/20 focus-visible:outline-none focus-visible:ring-foreground/40"
              >
                {user.picture_url ? (
                  <Image
                    src={user.picture_url}
                    alt={user.name || 'Profile'}
                    width={36}
                    height={36}
                    className="rounded-full object-cover"
                  />
                ) : (
                  // Fallback: first letter of name/email
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background">
                    {(user.name?.[0] || user.email[0]).toUpperCase()}
                  </div>
                )}
              </button>

              {/* Dropdown menu */}
              {menuOpen && (
                <div className="absolute right-0 top-full mt-3 w-56 overflow-hidden rounded-2xl border border-border/70 bg-card/90 backdrop-blur-2xl shadow-xl">
                  {/* User info */}
                  <div className="border-b border-border/50 px-4 py-3">
                    <p className="truncate text-sm font-medium text-foreground">
                      {user.name || 'User'}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {user.email}
                    </p>
                  </div>

                  {/* Menu items */}
                  <div className="p-1.5">
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        handleLogout();
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <LogOut className="size-4" />
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Not logged in: show Login button
            <Button
              onClick={handleLogin}
              variant="default"
              size="sm"
              className="h-11 rounded-[1.15rem] bg-foreground px-6 text-xs font-medium text-background shadow-none hover:bg-foreground/90"
            >
              Login
            </Button>
          )}
        </div>
      </nav>
    </header>
  );
}
