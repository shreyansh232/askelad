'use client';

import type { LucideIcon } from "lucide-react";
import {
  Activity,
  CheckCircle2,
  FileText,
  MessageCircle,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";

interface CapabilityCard {
  title: string;
  eyebrow: string;
  description: string;
  icon: LucideIcon;
  iconClassName: string;
  iconWrapClassName: string;
}

const capabilityCards: CapabilityCard[] = [
  {
    title: "Finance agent",
    eyebrow: "CFO",
    description: "Build projections, pressure-test pricing, and keep your runway visible.",
    icon: TrendingUp,
    iconClassName: "text-sky-200",
    iconWrapClassName: "border-sky-200/16 bg-sky-400/10",
  },
  {
    title: "Marketing agent",
    eyebrow: "CMO",
    description: "Shape messaging, channels, and GTM moves around your actual context.",
    icon: MessageCircle,
    iconClassName: "text-emerald-200",
    iconWrapClassName: "border-emerald-200/16 bg-emerald-400/10",
  },
  {
    title: "Product agent",
    eyebrow: "CPO",
    description: "Prioritize what to build next and translate founder chaos into a plan.",
    icon: FileText,
    iconClassName: "text-amber-100",
    iconWrapClassName: "border-amber-100/16 bg-amber-300/10",
  },
];

const workflowPoints = [
  "Keeps one shared memory of your startup instead of siloed chats.",
  "Flags blockers and missing documents before work goes off track.",
  "Routes next actions across finance, product, and growth in one place.",
];

export default function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="surface-mute relative left-1/2 w-screen -translate-x-1/2 scroll-mt-36 py-10 sm:py-12"
    >
      <div className="mx-auto max-w-6xl px-6 sm:px-8">
        <div className="mx-auto mb-8 max-w-6xl text-center">
          <h2 className="font-mono text-[clamp(1.9rem,2.6vw,2.8rem)] font-bold leading-tight tracking-[-0.03em] text-foreground md:whitespace-nowrap">
            How it works
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
            Specialist agents handle the work while one shared layer keeps everything aligned.
          </p>
        </div>

        <div className="grid w-full gap-4 md:grid-cols-3">
          {capabilityCards.map((card) => {
            const Icon = card.icon;

            return (
              <article
                key={card.title}
                className="rounded-[1.6rem] border border-border/70 bg-[#2f2f2f] p-6 text-left backdrop-blur-md transition-colors hover:border-white/16 hover:bg-[#313131]"
              >
                <div className="flex items-center justify-between">
                  <div className={`rounded-2xl border p-3 ${card.iconWrapClassName}`}>
                    <Icon className={`size-5 ${card.iconClassName}`} />
                  </div>
                  <span className="text-[0.68rem] uppercase tracking-[0.2em] text-foreground/42">
                    {card.eyebrow}
                  </span>
                </div>

                <h2 className="mt-6 font-mono text-xl text-foreground">{card.title}</h2>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  {card.description}
                </p>
              </article>
            );
          })}
        </div>

        <div className="mt-6 grid w-full gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-[1.9rem] border border-border/70 bg-[#2f2f2f] p-7 text-left backdrop-blur-md">
            <div className="flex items-center gap-3 text-sm text-foreground/65">
              <Users className="size-4 text-sky-200" />
              Cofounder layer
            </div>
            <h2 className="mt-4 font-mono text-[clamp(1.35rem,2.3vw,1.95rem)] leading-[1.1] tracking-[-0.03em] text-foreground">
              Your cofounder, keeping every agent aligned
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-[0.95rem]">
              It watches the full operating loop, catches blockers early, and keeps every
              specialist working from the same startup context.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {workflowPoints.map((point, index) => (
                <div key={point} className="rounded-[1.35rem] border border-white/8 bg-white/[0.025] p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/15 text-sm text-foreground/80">
                      {index + 1}
                    </div>
                    <div className="text-xs uppercase tracking-[0.18em] text-foreground/42">
                      Step {index + 1}
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-muted-foreground">{point}</p>
                </div>
              ))}
            </div>
          </section>

          <aside className="rounded-[1.9rem] border border-border/70 bg-[#2f2f2f] p-7 text-left backdrop-blur-md">
            <div className="flex items-center gap-3 text-sm text-foreground/65">
              <Activity className="size-4 text-emerald-200" />
              Live operating view
            </div>

            <div className="mt-6 space-y-4">
              <StatusRow
                icon={ShieldCheck}
                iconClassName="text-sky-200"
                iconWrapClassName="border-sky-200/16 bg-sky-400/10"
                label="Context retained"
                value="Project brief, metrics, goals"
              />
              <StatusRow
                icon={CheckCircle2}
                iconClassName="text-emerald-200"
                iconWrapClassName="border-emerald-200/16 bg-emerald-400/10"
                label="Clarification rules"
                value="No guessing on critical inputs"
              />
              <StatusRow
                icon={MessageCircle}
                iconClassName="text-amber-100"
                iconWrapClassName="border-amber-100/16 bg-amber-300/10"
                label="Founder loop"
                value="Updates when you need to decide"
              />
            </div>

            <div className="mt-6 rounded-[1.35rem] border border-white/8 bg-black/12 p-4">
              <div className="text-[0.68rem] uppercase tracking-[0.18em] text-foreground/42">
                Why this works
              </div>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                You get specialist advice without re-explaining the startup every time. The
                system stays coordinated, and the user only steps in when judgment or missing
                context is actually needed.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

function StatusRow({
  icon: Icon,
  iconClassName,
  iconWrapClassName,
  label,
  value,
}: {
  icon: LucideIcon;
  iconClassName: string;
  iconWrapClassName: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-4 rounded-[1.2rem] border border-white/8 bg-black/10 p-4">
      <div className={`rounded-2xl border p-2.5 ${iconWrapClassName}`}>
        <Icon className={`size-4 ${iconClassName}`} />
      </div>
      <div>
        <div className="text-sm text-foreground">{label}</div>
        <div className="mt-1 text-sm leading-6 text-muted-foreground">{value}</div>
      </div>
    </div>
  );
}
