'use client';

import { ArrowUpRight } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function Navbar() {
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

        <div className="flex items-center">
          <Button
            variant="default"
            size="sm"
            className="h-11 rounded-[1.15rem] bg-foreground px-6 text-xs font-medium text-background shadow-none hover:bg-foreground/90"
          >
            Login
          </Button>
        </div>
      </nav>
    </header>
  );
}
