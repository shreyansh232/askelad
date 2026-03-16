'use client';

import { ArrowRight } from "lucide-react";

import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";

export default function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:72px_72px] opacity-30" />
        <div className="absolute inset-x-0 top-0 h-[36rem] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.085),rgba(255,255,255,0)_62%)]" />
        <div className="absolute left-1/2 top-52 h-[26rem] w-[26rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.08),rgba(255,255,255,0)_70%)] blur-3xl" />
      </div>

      <Navbar />

      <main className="relative px-6 pt-36 sm:px-8 sm:pt-40">
        <section className="mx-auto flex min-h-[78vh] w-full max-w-6xl flex-col items-center text-center">

          <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-[linear-gradient(135deg,rgba(167,221,255,0.09),rgba(255,255,255,0.035)_42%,rgba(175,245,230,0.06))] px-4 py-2 text-xs uppercase tracking-[0.22em] text-foreground/78 backdrop-blur-md">
            <BadgeMark />
            AI staff for solo founders
          </div>

          <div className="mt-10 max-w-5xl">
            <h1 className="font-mono text-[clamp(2.65rem,6.2vw,5.15rem)] font-bold leading-[0.95] tracking-[-0.06em] text-foreground">
              <span className="block">Your AI</span>
              <span className="mt-3 block text-white/58">co-founding team</span>
            </h1>
          </div>

          <p className="mt-8 max-w-3xl text-balance font-sans text-[clamp(0.98rem,1.4vw,1.2rem)] leading-relaxed text-muted-foreground/95">
            Stop wearing every hat. Askelad gives solo founders an AI-powered CFO, CMO,
            and CPO, all aware of your startup&apos;s context and working together under one
            roof.
          </p>

          <div className="mt-12 flex flex-col items-center gap-4 sm:flex-row">
            <Button className="h-14 rounded-[1.15rem] bg-primary px-8 text-base font-medium text-primary-foreground shadow-none hover:bg-primary/92">
              Get started free
              <ArrowRight className="size-4" />
            </Button>
          </div>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-foreground/48">
            <span>Clarification-first</span>
            <span className="h-1 w-1 rounded-full bg-white/20" />
            <span>Shared startup context</span>
            <span className="h-1 w-1 rounded-full bg-white/20" />
            <span>Built for solo founders</span>
          </div>
        </section>
      </main>
    </div>
  );
}

function BadgeMark() {
  return (
    <span className="flex h-5 w-5 items-center justify-center rounded-full border border-sky-200/18 bg-[linear-gradient(135deg,rgba(167,221,255,0.16),rgba(255,255,255,0.05))]">
      <span className="flex h-2.5 w-2.5 items-center justify-center rounded-full border border-sky-100/35">
        <span className="h-1 w-1 rounded-full bg-sky-100/90" />
      </span>
    </span>
  );
}
