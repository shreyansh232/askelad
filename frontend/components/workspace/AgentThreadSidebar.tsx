"use client";

import { useState } from "react";
import {
  ChatCenteredText,
  Wallet,
  Megaphone,
  Book,
  Plus,
  Trash,
  PencilLine,
  CaretDown as ChevronDown,
  CaretRight as ChevronRight,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { AgentType, AgentThread, AgentSummaryItem } from "@/lib/agents";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// Define AGENTS structure locally for sidebar rendering
const AGENTS = [
  {
    id: "cofounder" as const,
    label: "Co-Founder",
    icon: ChatCenteredText,
    fallback: "Strategic founder guidance",
    color: "text-sky-400",
    bg: "bg-sky-400/10",
  },
  {
    id: "finance" as const,
    label: "Finance",
    icon: Wallet,
    fallback: "Cash, runway, and metrics",
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
  },
  {
    id: "marketing" as const,
    label: "Marketing",
    icon: Megaphone,
    fallback: "Positioning and growth",
    color: "text-orange-400",
    bg: "bg-orange-400/10",
  },
  {
    id: "product" as const,
    label: "Product",
    icon: Book,
    fallback: "Roadmap and customer value",
    color: "text-violet-400",
    bg: "bg-violet-400/10",
  },
] as const;

interface AgentThreadSidebarProps {
  activeAgent: AgentType;
  setActiveAgent: (agent: AgentType) => void;
  activeThreadId: string | null;
  setActiveThreadId: (id: string | null) => void;
  threads: AgentThread[];
  agentSummaryMap: Partial<Record<AgentType, AgentSummaryItem>>;
  isSidebarOpen: boolean;
  expandedAgent: AgentType | null;
  setExpandedAgent: (agent: AgentType | null) => void;
  onCreateThread: (agentType: AgentType) => Promise<void>;
  onRenameThread: (threadId: string, newTitle: string) => Promise<void>;
  onDeleteThread: (threadId: string) => Promise<void>;
}

function formatRelativeTime(timestamp?: string | null) {
  if (!timestamp) return "unknown";
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(timestamp).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

export function AgentThreadSidebar({
  activeAgent,
  setActiveAgent,
  activeThreadId,
  setActiveThreadId,
  threads,
  agentSummaryMap,
  isSidebarOpen,
  expandedAgent,
  setExpandedAgent,
  onCreateThread,
  onRenameThread,
  onDeleteThread,
}: AgentThreadSidebarProps) {
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editingThreadTitle, setEditingThreadTitle] = useState("");

  const handleRenameSubmit = async (threadId: string) => {
    const title = editingThreadTitle.trim();
    if (!title) {
      setEditingThreadId(null);
      return;
    }
    await onRenameThread(threadId, title);
    setEditingThreadId(null);
  };

  return (
    <nav className="w-full">
      <div className="space-y-2.5">
        {AGENTS.map((agent, index) => {
          const Icon = agent.icon;
          const isExpanded = expandedAgent === agent.id;
          const isActive = activeAgent === agent.id;
          const summary = agentSummaryMap[agent.id];
          const lastRun = summary?.latest_run;
          const hasUnresolved = (summary?.unresolved_clarifications ?? 0) > 0;
          const shortcutKey = index + 1;

          let subtitle: string = agent.fallback;
          if (lastRun?.completed_at) {
            subtitle = `Last active ${formatRelativeTime(lastRun.completed_at)}`;
          } else if (lastRun?.created_at) {
            subtitle = `Running ${formatRelativeTime(lastRun.created_at)}`;
          }

          // Get threads for this agent
          const agentThreads = threads.filter((t) => t.agent_type === agent.id);
          const sortedThreads = [...agentThreads].sort(
            (a, b) =>
              new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
          );

          return (
            <div key={agent.id} className="space-y-1">
              {/* Agent card row container */}
              <div className="group relative">
                <button
                  type="button"
                  onClick={() => {
                    setActiveAgent(agent.id);
                    if (isSidebarOpen) {
                      setExpandedAgent(isExpanded ? null : agent.id);
                    }
                  }}
                  className={cn(
                    "flex w-full items-center border text-left transition duration-200 cursor-pointer",
                    isSidebarOpen
                      ? "gap-3 rounded-[1.1rem] pl-3 pr-10 py-3" // Leave space for overlay buttons on hover
                      : "justify-center rounded-full px-0 py-1.5",
                    isActive
                      ? "border-white/12 bg-white/[0.09] text-white shadow-[0_12px_30px_rgba(0,0,0,0.18)]"
                      : "border-transparent text-white/52 hover:border-white/8 hover:bg-white/[0.05] hover:text-white/88",
                  )}
                  title={`${agent.label} (⌘${shortcutKey})`}
                >
                  {/* Brand Rounded Icon */}
                  <div className="relative">
                    <div
                      className={cn(
                        "flex shrink-0 items-center justify-center transition duration-200",
                        isSidebarOpen
                          ? "size-9 rounded-2xl"
                          : "size-11 rounded-full",
                        isActive ? agent.bg : `${agent.bg} opacity-60`,
                      )}
                    >
                      <Icon
                        className={cn(
                          "size-4 transition duration-200",
                          isActive
                            ? agent.color
                            : `${agent.color} opacity-50`,
                        )}
                      />
                    </div>
                    {/* Unread alert dot */}
                    {hasUnresolved && (
                      <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-amber-400/90 shadow-[0_0_8px_rgba(251,191,36,0.6)] animate-pulse" />
                    )}
                  </div>

                  {/* Text labels and caret chevron */}
                  {isSidebarOpen && (
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-sm font-medium">
                          {agent.label}
                        </p>
                        <span className="text-white/20 transition-transform duration-200 group-hover:text-white/40">
                          {isExpanded ? (
                            <ChevronDown className="size-3" />
                          ) : (
                            <ChevronRight className="size-3" />
                          )}
                        </span>
                      </div>
                      <p className="truncate text-xs text-white/32">
                        {subtitle}
                      </p>
                    </div>
                  )}
                </button>

                {/* Floating overlay actions on the extreme right of the card */}
                {isSidebarOpen && (
                  <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
                    {/* Create Thread button (Plus) */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void onCreateThread(agent.id);
                      }}
                      className="flex size-6 cursor-pointer items-center justify-center rounded-md border border-white/10 bg-[#141414]/90 text-white/40 opacity-100 md:opacity-0 transition duration-200 hover:bg-white/[0.08] hover:text-white md:group-hover:opacity-100 shadow-sm"
                      title="New Conversation"
                    >
                      <Plus className="size-3.5" />
                    </button>

                    {/* Keyboard Shortcut (hidden on hover so the plus button takes the rightmost spot) */}
                    <span className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-white/20 font-mono transition duration-200 hidden md:inline-block md:group-hover:hidden md:group-hover:opacity-0 shrink-0">
                      ⌘ {shortcutKey}
                    </span>
                  </div>
                )}
              </div>

              {/* Indented Thread List with Increased Width */}
              {isSidebarOpen && isExpanded && (
                <div className="pl-7 pr-1 py-0.5 space-y-1.5">
                  {sortedThreads.length > 0 ? (
                    sortedThreads.map((thread) => {
                      const isThreadActive = activeThreadId === thread.id;
                      const isEditing = editingThreadId === thread.id;

                      return (
                        <div
                          key={thread.id}
                          className={cn(
                            "group/thread relative flex items-center justify-between rounded px-2.5 py-1.5 text-xs transition duration-150",
                            isThreadActive
                              ? "text-white bg-white/[0.04]"
                              : "text-white/42 hover:bg-white/[0.015] hover:text-white/88"
                          )}
                        >
                          {isEditing ? (
                            <div className="w-full flex items-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                ref={(el) => {
                                  if (el) {
                                    el.focus();
                                    if (el.dataset.selected !== "true") {
                                      el.select();
                                      el.dataset.selected = "true";
                                    }
                                  }
                                }}
                                type="text"
                                value={editingThreadTitle}
                                onChange={(e) => setEditingThreadTitle(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    void handleRenameSubmit(thread.id);
                                  } else if (e.key === "Escape") {
                                    setEditingThreadId(null);
                                  }
                                }}
                                onBlur={() => void handleRenameSubmit(thread.id)}
                                className="w-full bg-transparent py-0 text-white placeholder:text-white/10 focus:outline-none border-b border-white/20"
                              />
                            </div>
                          ) : (
                            <>
                              <span
                                onClick={() => {
                                  setActiveAgent(agent.id);
                                  setActiveThreadId(thread.id);
                                }}
                                onDoubleClick={() => {
                                  setEditingThreadId(thread.id);
                                  setEditingThreadTitle(thread.title);
                                }}
                                className="min-w-0 flex-1 truncate cursor-pointer py-0.5 pr-6 text-xs font-normal"
                                title="Double-click to rename"
                              >
                                {thread.title}
                              </span>

                              {/* Action Buttons (visible only on hover of the thread row) */}
                              <div className="flex items-center gap-0.5 opacity-100 md:opacity-0 md:group-hover/thread:opacity-100 transition-opacity duration-150 shrink-0 ml-1.5">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingThreadId(thread.id);
                                    setEditingThreadTitle(thread.title);
                                  }}
                                  className="flex size-5 cursor-pointer items-center justify-center text-white/30 hover:text-white transition duration-150"
                                  title="Rename conversation"
                                >
                                  <PencilLine className="size-3" />
                                </button>
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <button
                                      type="button"
                                      onClick={(e) => e.stopPropagation()}
                                      className="flex size-5 cursor-pointer items-center justify-center text-white/30 hover:text-red-500 transition duration-150"
                                      title="Delete conversation"
                                    >
                                      <Trash className="size-3" />
                                    </button>
                                  </DialogTrigger>
                                  <DialogContent onClick={(e) => e.stopPropagation()}>
                                    <DialogHeader>
                                      <DialogTitle>Delete Conversation</DialogTitle>
                                      <DialogDescription>
                                        Are you sure you want to delete &quot;{thread.title}&quot;? This action cannot be undone.
                                      </DialogDescription>
                                    </DialogHeader>
                                    <DialogFooter className="gap-2 sm:gap-0">
                                      <DialogClose asChild>
                                        <Button variant="ghost" className="text-white/60 hover:text-white hover:bg-white/5">
                                          Cancel
                                        </Button>
                                      </DialogClose>
                                      <Button
                                        variant="destructive"
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          await onDeleteThread(thread.id);
                                        }}
                                      >
                                        Delete
                                      </Button>
                                    </DialogFooter>
                                  </DialogContent>
                                </Dialog>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="px-2.5 py-1 text-[10px] text-white/18 italic">
                      No conversations yet
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
