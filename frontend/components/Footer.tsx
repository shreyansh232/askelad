'use client';

import { ArrowUpRight, Github } from "lucide-react";

export default function Footer() {
  return (
    <footer className="relative left-1/2 w-screen -translate-x-1/2 border-t border-white/10 bg-[#141414] py-14 sm:py-16">
      <div className="mx-auto max-w-6xl px-6 sm:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          <div className="max-w-xl">
            <div className="font-mono text-[clamp(1.45rem,2vw,1.9rem)] text-foreground">Askelad</div>
            <p className="mt-4 max-w-lg text-sm leading-7 text-muted-foreground sm:text-base">
              A coordinated AI team for solo founders who need sharper decisions across product,
              finance, and growth without re-explaining the business every time.
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2">
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-foreground/42">Explore</div>
              <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                <a href="#how-it-works" className="block transition-colors hover:text-foreground">
                  How it works
                </a>
                <a href="#faqs" className="block transition-colors hover:text-foreground">
                  FAQs
                </a>
              </div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-foreground/42">Repository</div>
              <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                <a
                  href="https://github.com/shreyansh232/askelad"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 transition-colors hover:text-foreground"
                >
                  <Github className="size-4" />
                  GitHub
                  <ArrowUpRight className="size-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-white/8 pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div>Open source under the MIT License.</div>
          <div>Built for solo founders and early-stage builders.</div>
        </div>
      </div>
    </footer>
  );
}
