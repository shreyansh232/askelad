"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Warning,
  Check,
  Clock,
  CircleNotch,
  Plus,
  Target,
  ArrowsCounterClockwise,
  X,
} from "@phosphor-icons/react";

import {
  createDigest,
  createMonitor,
  createTask,
  getWorkQueue,
  listArtifacts,
  listDigests,
  listMonitors,
  updateTask,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/work";
import { cn } from "@/lib/utils";
import { ArtifactCard, EmptyState, MonitorCard } from "./FounderWorkCards";

interface FounderWorkPanelProps {
  projectId: string;
  onClose: () => void;
}

type WorkTab = "queue" | "artifacts" | "cofounder";

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "Todo",
  in_progress: "In progress",
  blocked: "Blocked",
  waiting_for_user: "Waiting",
  done: "Done",
  archived: "Archived",
};

const PRIORITY_TONE: Record<TaskPriority, string> = {
  low: "text-white/36 border-white/8",
  medium: "text-sky-200/70 border-sky-300/12",
  high: "text-amber-200/80 border-amber-300/16",
  urgent: "text-red-200/90 border-red-300/20",
};

function invalidateWork(queryClient: ReturnType<typeof useQueryClient>, projectId: string) {
  queryClient.invalidateQueries({ queryKey: ["projects", projectId, "work-queue"] });
  queryClient.invalidateQueries({ queryKey: ["projects", projectId, "tasks"] });
  queryClient.invalidateQueries({ queryKey: ["projects", projectId, "artifacts"] });
  queryClient.invalidateQueries({ queryKey: ["projects", projectId, "cofounder"] });
}

function TaskCard({ projectId, task }: { projectId: string; task: Task }) {
  const queryClient = useQueryClient();
  const completeMutation = useMutation({
    mutationFn: () => updateTask(projectId, task.id, { status: "done" }),
    onSuccess: () => invalidateWork(queryClient, projectId),
  });

  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.025] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="line-clamp-2 text-sm font-medium leading-5 text-white/88">
            {task.title}
          </p>
          {task.description ? (
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/42">
              {task.description}
            </p>
          ) : null}
        </div>
        {task.status !== "done" ? (
          <button
            type="button"
            onClick={() => completeMutation.mutate()}
            className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/8 text-white/38 transition hover:bg-white/[0.06] hover:text-emerald-200"
            title="Mark done"
            aria-label="Mark task done"
          >
            {completeMutation.isPending ? (
              <CircleNotch className="size-3.5 animate-spin" />
            ) : (
              <Check className="size-3.5" />
            )}
          </button>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em]",
            PRIORITY_TONE[task.priority],
          )}
        >
          {task.priority}
        </span>
        <span className="rounded-full border border-white/8 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-white/36">
          {STATUS_LABEL[task.status]}
        </span>
        {task.owner_agent_type ? (
          <span className="rounded-full border border-white/8 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-white/36">
            {task.owner_agent_type}
          </span>
        ) : null}
      </div>

      {task.blocked_reason ? (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-red-300/12 bg-red-400/[0.04] p-2 text-xs leading-5 text-red-100/68">
          <Warning className="mt-0.5 size-3.5 shrink-0" />
          {task.blocked_reason}
        </div>
      ) : null}
    </div>
  );
}

function QueueTab({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const { data: queue, isLoading } = useQuery({
    queryKey: ["projects", projectId, "work-queue"],
    queryFn: () => getWorkQueue(projectId),
  });
  const createMutation = useMutation({
    mutationFn: () => createTask(projectId, { title, priority }),
    onSuccess: () => {
      setTitle("");
      setPriority("medium");
      invalidateWork(queryClient, projectId);
    },
  });

  if (isLoading) {
    return <CircleNotch className="mx-auto mt-12 size-5 animate-spin text-white/28" />;
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2">
        <Metric label="Today" value={queue?.today.length ?? 0} />
        <Metric label="Blocked" value={queue?.blocked.length ?? 0} tone="red" />
        <Metric label="Waiting" value={queue?.waiting_for_you.length ?? 0} tone="amber" />
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (title.trim()) createMutation.mutate();
        }}
        className="rounded-lg border border-white/[0.08] bg-black/15 p-2"
      >
        <div className="flex gap-2">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Add founder task"
            className="min-w-0 flex-1 bg-transparent px-2 text-sm text-white placeholder:text-white/24 focus:outline-none"
          />
          <select
            value={priority}
            onChange={(event) => setPriority(event.target.value as TaskPriority)}
            className="cursor-pointer rounded-md border border-white/8 bg-[#1b1b1b] px-2 text-xs text-white/58"
          >
            <option value="low">Low</option>
            <option value="medium">Med</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
          <button
            type="submit"
            disabled={!title.trim() || createMutation.isPending}
            className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md bg-white text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Add task"
          >
            {createMutation.isPending ? (
              <CircleNotch className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
          </button>
        </div>
      </form>

      <TaskSection title="Today" tasks={queue?.today ?? []} projectId={projectId} />
      <TaskSection title="Blocked" tasks={queue?.blocked ?? []} projectId={projectId} />
      <TaskSection
        title="Waiting for you"
        tasks={queue?.waiting_for_you ?? []}
        projectId={projectId}
      />
      <TaskSection title="Upcoming" tasks={queue?.upcoming ?? []} projectId={projectId} />
    </div>
  );
}

function Metric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "red" | "amber";
}) {
  const toneClass =
    tone === "red"
      ? "text-red-100"
      : tone === "amber"
        ? "text-amber-100"
        : "text-white";
  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.025] p-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-white/28">{label}</p>
      <p className={cn("mt-2 text-2xl font-semibold", toneClass)}>{value}</p>
    </div>
  );
}

function TaskSection({
  title,
  tasks,
  projectId,
}: {
  title: string;
  tasks: Task[];
  projectId: string;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[10px] uppercase tracking-[0.22em] text-white/32">
          {title}
        </h3>
        <span className="text-xs text-white/24">{tasks.length}</span>
      </div>
      <div className="space-y-2">
        {tasks.length > 0 ? (
          tasks.map((task) => <TaskCard key={task.id} projectId={projectId} task={task} />)
        ) : (
          <EmptyState label="Nothing here" />
        )}
      </div>
    </section>
  );
}

function ArtifactsTab({ projectId }: { projectId: string }) {
  const { data: artifacts, isLoading } = useQuery({
    queryKey: ["projects", projectId, "artifacts"],
    queryFn: () => listArtifacts(projectId),
  });

  if (isLoading) {
    return <CircleNotch className="mx-auto mt-12 size-5 animate-spin text-white/28" />;
  }

  if (!artifacts?.length) {
    return <EmptyState label="Agent deliverables will appear here" />;
  }

  return (
    <div className="space-y-2">
      {artifacts.map((artifact) => (
        <ArtifactCard key={artifact.id} projectId={projectId} artifact={artifact} />
      ))}
    </div>
  );
}

function CofounderTab({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const [monitorTitle, setMonitorTitle] = useState("");
  const [monitorQuery, setMonitorQuery] = useState("");
  const { data: digests } = useQuery({
    queryKey: ["projects", projectId, "cofounder", "digests"],
    queryFn: () => listDigests(projectId),
  });
  const { data: monitors } = useQuery({
    queryKey: ["projects", projectId, "cofounder", "monitors"],
    queryFn: () => listMonitors(projectId),
  });
  const digestMutation = useMutation({
    mutationFn: () => createDigest(projectId, "daily"),
    onSuccess: () => invalidateWork(queryClient, projectId),
  });
  const monitorMutation = useMutation({
    mutationFn: () =>
      createMonitor(projectId, {
        title: monitorTitle,
        monitor_type: "competitor",
        query: monitorQuery,
        cadence: "weekly",
      }),
    onSuccess: () => {
      setMonitorTitle("");
      setMonitorQuery("");
      invalidateWork(queryClient, projectId);
    },
  });

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={() => digestMutation.mutate()}
        className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-black transition hover:bg-white/90"
      >
        {digestMutation.isPending ? (
          <CircleNotch className="size-4 animate-spin" />
        ) : (
          <ArrowsCounterClockwise className="size-4" />
        )}
        Generate cofounder brief
      </button>

      <section>
        <h3 className="mb-2 text-[10px] uppercase tracking-[0.22em] text-white/32">
          Latest briefs
        </h3>
        <div className="space-y-2">
          {digests?.length ? (
            digests.slice(0, 3).map((digest) => (
              <div
                key={digest.id}
                className="rounded-lg border border-white/[0.08] bg-white/[0.025] p-3"
              >
                <div className="flex items-center gap-2 text-xs text-white/34">
                  <Clock className="size-3.5" />
                  {new Date(digest.created_at).toLocaleString()}
                </div>
                <p className="mt-2 text-sm font-medium text-white/86">{digest.title}</p>
                <p className="mt-1 text-xs leading-5 text-white/48">{digest.summary}</p>
              </div>
            ))
          ) : (
            <EmptyState label="No briefs generated yet" />
          )}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-[10px] uppercase tracking-[0.22em] text-white/32">
          Monitors
        </h3>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (monitorTitle.trim() && monitorQuery.trim()) monitorMutation.mutate();
          }}
          className="mb-2 space-y-2 rounded-lg border border-white/[0.08] bg-black/15 p-2"
        >
          <input
            value={monitorTitle}
            onChange={(event) => setMonitorTitle(event.target.value)}
            placeholder="Monitor name"
            className="w-full rounded-md border border-white/8 bg-transparent px-2 py-2 text-sm text-white placeholder:text-white/24 focus:outline-none"
          />
          <input
            value={monitorQuery}
            onChange={(event) => setMonitorQuery(event.target.value)}
            placeholder="Competitor, market, or risk to watch"
            className="w-full rounded-md border border-white/8 bg-transparent px-2 py-2 text-sm text-white placeholder:text-white/24 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!monitorTitle.trim() || !monitorQuery.trim()}
            className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-white/10 px-2 py-2 text-xs text-white/62 transition hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Target className="size-3.5" />
            Add monitor
          </button>
        </form>
        <div className="space-y-2">
          {monitors?.length ? (
            monitors.map((monitor) => <MonitorCard key={monitor.id} monitor={monitor} />)
          ) : (
            <EmptyState label="No active monitors" />
          )}
        </div>
      </section>
    </div>
  );
}

export function FounderWorkPanel({ projectId, onClose }: FounderWorkPanelProps) {
  const [activeTab, setActiveTab] = useState<WorkTab>("queue");
  const tabs = useMemo(
    () => [
      { id: "queue" as const, label: "Queue" },
      { id: "artifacts" as const, label: "Artifacts" },
      { id: "cofounder" as const, label: "Cofounder" },
    ],
    [],
  );

  return (
    <aside className="flex h-full w-[420px] shrink-0 flex-col border-l border-white/8 bg-[#141414]">
      <header className="border-b border-white/8 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-white/28">
              Founder operations
            </p>
            <h2 className="mt-1 text-base font-semibold text-white/90">Work Queue</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-9 cursor-pointer items-center justify-center rounded-full text-white/42 transition hover:bg-white/[0.06] hover:text-white"
            aria-label="Close work queue"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-1 rounded-lg border border-white/[0.08] bg-black/18 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "cursor-pointer rounded-md px-2 py-1.5 text-xs transition",
                activeTab === tab.id
                  ? "bg-white text-black"
                  : "text-white/42 hover:bg-white/[0.05] hover:text-white/74",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4" data-lenis-prevent>
        {activeTab === "queue" ? <QueueTab projectId={projectId} /> : null}
        {activeTab === "artifacts" ? <ArtifactsTab projectId={projectId} /> : null}
        {activeTab === "cofounder" ? <CofounderTab projectId={projectId} /> : null}
      </div>
    </aside>
  );
}
