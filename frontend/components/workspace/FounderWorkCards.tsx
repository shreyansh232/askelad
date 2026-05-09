"use client";

import { Download, FileText } from "lucide-react";

import type { Artifact, CofounderMonitor } from "@/lib/work";

export function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-white/[0.08] px-3 py-6 text-center text-xs text-white/30">
      {label}
    </div>
  );
}

export function ArtifactCard({
  projectId,
  artifact,
}: {
  projectId: string;
  artifact: Artifact;
}) {
  const exportHref = (format: "markdown" | "csv" | "pdf") =>
    `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api"}/projects/${projectId}/artifacts/${artifact.id}/export?format=${format}`;

  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.025] p-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-white/[0.05] text-white/42">
          <FileText className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white/88">
            {artifact.title}
          </p>
          <p className="mt-1 text-xs text-white/34">
            {artifact.artifact_type.replace(/_/g, " ")} · v
            {artifact.current_version?.version ?? 1}
          </p>
          {artifact.current_version?.content ? (
            <p className="mt-3 line-clamp-3 text-xs leading-5 text-white/46">
              {artifact.current_version.content}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-3 flex gap-1.5">
        {(["markdown", "csv", "pdf"] as const).map((format) => (
          <a
            key={format}
            href={exportHref(format)}
            className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-white/8 px-2 py-1 text-[11px] text-white/42 transition hover:bg-white/[0.05] hover:text-white/74"
          >
            <Download className="size-3" />
            {format}
          </a>
        ))}
      </div>
    </div>
  );
}

export function MonitorCard({ monitor }: { monitor: CofounderMonitor }) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.025] p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-sm font-medium text-white/84">
          {monitor.title}
        </p>
        <span className="rounded-full border border-emerald-300/14 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-emerald-100/62">
          {monitor.status}
        </span>
      </div>
      <p className="mt-2 line-clamp-2 text-xs leading-5 text-white/42">
        {monitor.query}
      </p>
    </div>
  );
}
