"use client";

import { useEffect, useMemo, useRef, useState, useCallback, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUp,
  Book,
  CaretDown as ChevronDown,
  CaretRight as ChevronRight,
  Command,
  Download,
  FileImage,
  FileText,
  FolderOpen,
  Globe,
  CircleNotch,
  Megaphone,
  ChatCenteredText,
  DotsThree,
  PencilLine,
  Plus,
  MagnifyingGlass,
  Gear,
  Sparkle,
  Trash,
  Upload,
  Wallet,
  X,
  SignOut,
  CaretDoubleLeft,
  CaretDoubleRight,
} from "@phosphor-icons/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { useAuth } from "@/hooks/useAuth";
import {
  createAgentMessage,
  getAgentSummary,
  listAgentMessages,
  resolveClarification,
  streamAgentRun,
  listAgentThreads,
  createAgentThread,
  renameAgentThread,
  deleteAgentThread,
  type AgentMessage,
  type AgentSummaryItem,
  type AgentType,
  type ClarificationRequest,
  type AgentThread,
} from "@/lib/agents";
import {
  deleteDocument,
  listDocuments,
  listProjects,
  uploadDocument,
  type Project,
} from "@/lib/projects";
import { cn } from "@/lib/utils";
import { FounderWorkPanel } from "@/components/workspace/FounderWorkPanel";
import { AgentThreadSidebar } from "@/components/workspace/AgentThreadSidebar";

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
    icon: PencilLine,
    fallback: "Roadmap and customer value",
    color: "text-violet-400",
    bg: "bg-violet-400/10",
  },
] as const;

type ActivityTone = "neutral" | "context" | "search" | "draft" | "error";

interface StreamActivity {
  id: string;
  title: string;
  detail: string;
  tone: ActivityTone;
}

function getAgentMeta(agentType: AgentType) {
  return AGENTS.find((agent) => agent.id === agentType) ?? AGENTS[0];
}

function formatMessageTime(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function summarizeDocumentNames(documentNames: string[]) {
  if (documentNames.length === 0) {
    return "No uploaded documents yet. Using project details only.";
  }

  if (documentNames.length <= 3) {
    return documentNames.join(" • ");
  }

  return `${documentNames.slice(0, 3).join(" • ")} +${documentNames.length - 3} more`;
}

function getStringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function getStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function getRecordValue(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function upsertActivity(
  activities: StreamActivity[],
  nextActivity: StreamActivity,
) {
  const index = activities.findIndex(
    (activity) => activity.id === nextActivity.id,
  );

  if (index === -1) {
    return [...activities, nextActivity];
  }

  const next = [...activities];
  next[index] = nextActivity;
  return next;
}

function ActivityIcon({ tone }: { tone: ActivityTone }) {
  const className = "size-3.5";

  if (tone === "context") {
    return <Book className={className} />;
  }

  if (tone === "search") {
    return <Globe className={className} />;
  }

  if (tone === "error") {
    return <ChevronRight className={className} />;
  }

  if (tone === "draft") {
    return <Sparkle className={className} />;
  }

  return <CircleNotch className={`${className} animate-spin`} />;
}

export default function ProjectPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const messageRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const { isLoading: authLoading, isLoggedIn, user, handleLogout } = useAuth();

  const [activeAgent, setActiveAgent] = useState<AgentType>("cofounder");
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [streamingThreadId, setStreamingThreadId] = useState<string | null>(null);
  const [expandedAgent, setExpandedAgent] = useState<AgentType | null>("cofounder");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [profileImageError, setProfileImageError] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [inputValue, setInputValue] = useState("");
  // Pending attachments (local files waiting to be uploaded with the message)
  const [pendingAttachments, setPendingAttachments] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingRunId, setStreamingRunId] = useState<string | null>(null);
  const [streamingAgent, setStreamingAgent] = useState<AgentType | null>(null);
  const [streamActivities, setStreamActivities] = useState<StreamActivity[]>(
    [],
  );
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(true);
  const [projectMenuOpenId, setProjectMenuOpenId] = useState<string | null>(
    null,
  );
  const [isWorkPanelOpen, setIsWorkPanelOpen] = useState(false);

  const {
    data: projects,
    isLoading: projectsLoading,
    error,
  } = useQuery({
    queryKey: ["projects", "list"],
    queryFn: listProjects,
    enabled: isLoggedIn,
  });

  const project = useMemo<Project | null>(() => {
    if (!projects || projects.length === 0) {
      return null;
    }

    if (selectedProjectId) {
      return projects.find((p) => p.id === selectedProjectId) ?? projects[0];
    }

    if (!selectedProjectId && projects.length > 0) {
      setSelectedProjectId(projects[0].id);
    }

    return projects[0];
  }, [projects, selectedProjectId]);

  const { data: threads, isLoading: threadsLoading } = useQuery<AgentThread[]>({
    queryKey: ["projects", project?.id, "threads"],
    queryFn: () => listAgentThreads(project!.id),
    enabled: !!project,
  });

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ["projects", project?.id, "threads", activeThreadId, "messages"],
    queryFn: () => listAgentMessages(project!.id, activeThreadId!),
    enabled: !!project && !!activeThreadId,
  });

  const { data: documents } = useQuery({
    queryKey: ["projects", project?.id, "documents"],
    queryFn: () => listDocuments(project!.id),
    enabled: !!project,
  });

  const { data: agentSummary } = useQuery({
    queryKey: ["projects", project?.id, "agents", "summary"],
    queryFn: () => getAgentSummary(project!.id),
    enabled: !!project,
    refetchInterval: 30_000,
  });

  const agentSummaryMap = useMemo(() => {
    const map: Partial<Record<AgentType, AgentSummaryItem>> = {};
    if (agentSummary?.agents) {
      for (const item of agentSummary.agents) {
        map[item.agent_type] = item;
      }
    }
    return map;
  }, [agentSummary]);

  useEffect(() => {
    if (!project || !threads || threadsLoading) return;

    const agentThreads = threads.filter((t) => t.agent_type === activeAgent);

    if (agentThreads.length > 0) {
      const currentActiveThread = threads.find((t) => t.id === activeThreadId);
      if (!activeThreadId || currentActiveThread?.agent_type !== activeAgent) {
        const sorted = [...agentThreads].sort(
          (a, b) =>
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );
        setActiveThreadId(sorted[0].id);
      }
    } else {
      const autoCreate = async () => {
        try {
          const newThread = await createAgentThread(project.id, activeAgent);
          await queryClient.invalidateQueries({
            queryKey: ["projects", project.id, "threads"],
          });
          setActiveThreadId(newThread.id);
        } catch (e) {
          console.error("Failed to auto-create thread:", e);
        }
      };
      void autoCreate();
    }
  }, [
    activeAgent,
    threads,
    activeThreadId,
    project,
    threadsLoading,
    queryClient,
  ]);

  useEffect(() => {
    setExpandedAgent(activeAgent);
  }, [activeAgent]);

  const messages = useMemo(() => history?.messages ?? [], [history]);
  const clarifications = useMemo(
    () => history?.clarifications ?? [],
    [history],
  );
  const activeAgentMeta = getAgentMeta(activeAgent);
  const streamingAgentMeta = streamingAgent
    ? getAgentMeta(streamingAgent)
    : null;
  const isActiveAgentStreaming =
    !!streamingRunId && streamingAgent === activeAgent;
  const latestActivity = streamActivities[streamActivities.length - 1];
  const documentNames = useMemo(
    () => (documents ?? []).map((document) => document.filename),
    [documents],
  );
  const searchMatches = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return [];
    }

    return messages.reduce<number[]>((matches, message, index) => {
      if (message.content.toLowerCase().includes(normalizedQuery)) {
        matches.push(index);
      }
      return matches;
    }, []);
  }, [messages, searchQuery]);
  const activeSearchMatch = searchMatches[activeSearchIndex] ?? null;

  const handleOpenSearch = useCallback(() => {
    if (!isSearchOpen) {
      setIsSearchOpen(true);
      return;
    }

    if (searchMatches.length > 0) {
      setActiveSearchIndex((current) => (current + 1) % searchMatches.length);
      return;
    }

    searchInputRef.current?.focus();
  }, [isSearchOpen, searchMatches.length]);

  const openClarification = useMemo(
    () => clarifications.find((c) => c.status === "open"),
    [clarifications],
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent, streamActivities.length, activeAgent]);

  useEffect(() => {
    if (!isSearchOpen) {
      return;
    }

    searchInputRef.current?.focus();
  }, [isSearchOpen]);

  useEffect(() => {
    if (searchMatches.length === 0) {
      setActiveSearchIndex(0);
      return;
    }

    setActiveSearchIndex((current) =>
      Math.min(current, searchMatches.length - 1),
    );
  }, [searchMatches]);

  useEffect(() => {
    if (activeSearchMatch === null) {
      return;
    }

    messageRefs.current[activeSearchMatch]?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [activeSearchMatch]);

  // Keyboard shortcuts: ⌘1–4 for agent switching, ⌘K for command palette
  useEffect(() => {
    const agentKeys: AgentType[] = [
      "cofounder",
      "finance",
      "marketing",
      "product",
    ];

    function handleKeyDown(e: KeyboardEvent) {
      if (!e.metaKey && !e.ctrlKey) return;

      // ⌘1–4: switch agents
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 4) {
        e.preventDefault();
        setActiveAgent(agentKeys[num - 1]);
        return;
      }

      // ⌘K: toggle command palette
      if (e.key === "k") {
        e.preventDefault();
        handleOpenSearch();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleOpenSearch]);

  useEffect(() => {
    const composer = composerRef.current;
    if (!composer) {
      return;
    }

    composer.style.height = "0px";
    composer.style.height = `${Math.min(composer.scrollHeight, 220)}px`;
  }, [inputValue]);

  useEffect(() => {
    if (!project || !streamingRunId || !streamingThreadId) {
      return;
    }

    let controller: AbortController | null = null;

    const startStream = async () => {
      try {
        await streamAgentRun(
          project.id,
          streamingThreadId,
          streamingRunId,
          (event, data) => {
            if (event === "run.started") {
              setStreamActivities([
                {
                  id: "intake",
                  title: "Thinking",
                  detail: "Understanding your request",
                  tone: "neutral",
                },
              ]);
              return;
            }

            if (event === "run.context_loaded") {
              const contextDocuments =
                getStringArray(data.documents).length > 0
                  ? getStringArray(data.documents)
                  : documentNames;

              setStreamActivities((current) =>
                upsertActivity(current, {
                  id: "context",
                  title:
                    contextDocuments.length > 0
                      ? "Exploring project files"
                      : "Reviewing project brief",
                  detail:
                    contextDocuments.length > 0
                      ? summarizeDocumentNames(contextDocuments)
                      : "Using project details only",
                  tone: "context",
                }),
              );
              return;
            }

            if (event === "tool.called") {
              const argumentsValue = getRecordValue(data.arguments);
              const toolName = getStringValue(data.tool_name, "tool");
              
              let title = `Running ${toolName}`;
              let detail = JSON.stringify(argumentsValue ?? {});
              let tone: ActivityTone = "search";

              if (toolName === "web_search") {
                const query = getStringValue(argumentsValue?.query, "Searching the web");
                const searchDepth = getStringValue(argumentsValue?.search_depth) === "advanced" ? "Advanced depth" : "Quick scan";
                title = `Searching for "${query}"`;
                detail = searchDepth;
                tone = "search";
              } else if (toolName === "access_skill_file") {
                const skillName = getStringValue(argumentsValue?.skill_name, "skill");
                title = `Reading skill: ${skillName}`;
                detail = "Loading expert guidelines";
                tone = "context";
              } else if (toolName === "list_skills") {
                title = "Listing available skills";
                detail = "Searching backend skills repository";
                tone = "context";
              } else if (toolName === "list_mcp_servers") {
                title = "Discovering MCP servers";
                detail = "Listing connected data sources";
                tone = "search";
              } else if (toolName === "call_mcp_tool") {
                const serverName = getStringValue(argumentsValue?.server_name, "mcp");
                const mcpToolName = getStringValue(argumentsValue?.tool_name, "tool");
                title = `MCP Server: ${serverName}`;
                detail = `Executing tool: ${mcpToolName}`;
                tone = "search";
              }

              setStreamActivities((current) =>
                upsertActivity(current, {
                  id: `tool-${toolName}-${JSON.stringify(argumentsValue)}`,
                  title,
                  detail,
                  tone,
                }),
              );
              return;
            }

            if (event === "tool.completed") {
              const toolName = getStringValue(data.tool_name, "tool");
              
              let title = `${toolName} finished`;
              let detail = getStringValue(data.summary, "Tool execution completed.");
              let tone: ActivityTone = "search";

              if (toolName === "web_search") {
                title = "Search results ready";
                tone = "search";
              } else if (toolName === "access_skill_file") {
                title = "Loaded skill details";
                detail = getStringValue(data.summary, "Skill instructions imported.");
                tone = "context";
              } else if (toolName === "list_skills") {
                title = "Skills repository mapped";
                detail = getStringValue(data.summary, "Available guidelines retrieved.");
                tone = "context";
              } else if (toolName === "list_mcp_servers") {
                title = "MCP servers mapped";
                detail = getStringValue(data.summary, "Available MCP servers retrieved.");
                tone = "search";
              } else if (toolName === "call_mcp_tool") {
                title = "MCP execution completed";
                detail = getStringValue(data.summary, "Data retrieved successfully.");
                tone = "search";
              }

              setStreamActivities((current) =>
                upsertActivity(current, {
                  id: `tool-result-${toolName}`,
                  title,
                  detail,
                  tone,
                }),
              );
              return;
            }

            if (event === "clarification.detected") {
              setStreamActivities((current) =>
                upsertActivity(current, {
                  id: "clarification",
                  title: "Needs more input",
                  detail: getStringValue(
                    data.question,
                    "The agent needs clarification before it can finish.",
                  ),
                  tone: "error",
                }),
              );
              return;
            }

            if (event === "message.delta") {
              setStreamingContent(
                (current) => current + (data.delta ?? data.content ?? ""),
              );
              setStreamActivities((current) =>
                upsertActivity(current, {
                  id: "drafting",
                  title: "Writing response",
                  detail: "Turning findings into an answer",
                  tone: "draft",
                }),
              );
              return;
            }

            if (event === "run.completed" || event === "run.failed") {
              const streamedThread = streamingThreadId;

              setStreamingRunId(null);
              setStreamingAgent(null);
              setStreamingThreadId(null);
              setStreamingContent("");
              setStreamActivities([]);

              queryClient.invalidateQueries({
                queryKey: [
                  "projects",
                  project.id,
                  "threads",
                  streamedThread,
                  "messages",
                ],
              });
            }
          },
          (nextController) => {
            controller = nextController;
          },
        );
      } catch (streamError) {
        console.error("Streaming failed:", streamError);
        setStreamingRunId(null);
        setStreamingAgent(null);
        setStreamingThreadId(null);
        setStreamingContent("");
        setStreamActivities([]);
      }
    };

    startStream();

    return () => {
      controller?.abort();
    };
  }, [documentNames, project, queryClient, streamingThreadId, streamingRunId]);

  useEffect(() => {
    if (!authLoading && !isLoggedIn) {
      router.replace("/login");
    }
  }, [authLoading, isLoggedIn, router]);

  useEffect(() => {
    if (!authLoading && isLoggedIn && !projectsLoading && !error && !project) {
      router.replace("/onboarding");
    }
  }, [authLoading, error, isLoggedIn, project, projectsLoading, router]);

  const handleSendMessage = async () => {
    if (
      !project ||
      (!inputValue.trim() && pendingAttachments.length === 0) ||
      isSending ||
      !!streamingRunId
    ) {
      return;
    }

    const content = inputValue.trim();
    const attachmentsToUpload = [...pendingAttachments];
    setInputValue("");
    setIsSending(true);
    setStreamingContent("");
    setStreamActivities([
      {
        id: "intake",
        title: "Thinking",
        detail: "Understanding your request",
        tone: "neutral",
      },
    ]);

    try {
      // Upload pending attachments first
      let attachmentIds: string[] = [];
      try {
        const uploadedDocs = await Promise.all(
          attachmentsToUpload.map((file) => uploadDocument(project.id, file)),
        );
        attachmentIds = uploadedDocs.map((doc) => doc.id);
      } catch (uploadError) {
        console.error("Upload failed:", uploadError);
        // Restore attachments on failure
        setPendingAttachments(attachmentsToUpload);
        setStreamActivities([]);
        alert("Failed to upload attachment. Please try again.");
        setIsSending(false);
        return;
      }
      setPendingAttachments([]); // Clear pending attachments after upload

      const response = await createAgentMessage(
        project.id,
        activeThreadId!,
        content,
        attachmentIds,
      );

      queryClient.setQueryData(
        ["projects", project.id, "threads", activeThreadId, "messages"],
        (
          old:
            | {
                messages?: AgentMessage[];
                clarifications?: ClarificationRequest[];
              }
            | undefined,
        ) => ({
          ...old,
          messages: [...(old?.messages ?? []), response.user_message],
          clarifications: old?.clarifications ?? [],
        }),
      );

      queryClient.invalidateQueries({
        queryKey: ["projects", project.id, "threads"],
      });

      setStreamingAgent(activeAgent);
      setStreamingThreadId(activeThreadId);
      setStreamingRunId(response.run.id);
    } catch (sendError) {
      console.error("Failed to send message:", sendError);
      // Restore attachments on failure
      setPendingAttachments(attachmentsToUpload);
      setInputValue(content);
      setStreamActivities([]);
      alert("Failed to send message. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  const handleResolveClarification = async (clarificationId: string) => {
    if (!project || isSending || !!streamingRunId) {
      return;
    }

    const note = inputValue.trim();
    if (!note && pendingAttachments.length === 0) {
      return;
    }

    const attachmentsToUpload = [...pendingAttachments];
    setInputValue("");
    setPendingAttachments([]);

    try {
      setIsSending(true);
      setStreamingContent("");
      setStreamActivities([
        {
          id: "resume",
          title: "Thinking",
          detail: "Resuming the task with your input",
          tone: "neutral",
        },
      ]);

      let attachmentIds: string[] = [];
      if (attachmentsToUpload.length > 0) {
        const uploadedDocs = await Promise.all(
          attachmentsToUpload.map((file) => uploadDocument(project.id, file)),
        );
        attachmentIds = uploadedDocs.map((document) => document.id);
        queryClient.invalidateQueries({
          queryKey: ["projects", project.id, "documents"],
        });
      }

      const clarificationResponse = await resolveClarification(
        project.id,
        clarificationId,
        note || "Attached requested documents.",
        attachmentIds,
      );

      queryClient.setQueryData(
        ["projects", project.id, "threads", activeThreadId, "messages"],
        (
          old:
            | {
                messages?: AgentMessage[];
                clarifications?: ClarificationRequest[];
              }
            | undefined,
        ) => ({
          ...old,
          messages: [
            ...(old?.messages ?? []),
            clarificationResponse.user_message,
          ],
          clarifications: (old?.clarifications ?? []).map((clarification) =>
            clarification.id === clarificationId
              ? clarificationResponse.clarification
              : clarification,
          ),
        }),
      );

      queryClient.invalidateQueries({
        queryKey: ["projects", project.id, "agents", "summary"],
      });

      setStreamingAgent(clarificationResponse.run.agent_type);
      setStreamingThreadId(activeThreadId);
      setStreamingRunId(clarificationResponse.run.id);
    } catch (resolveError) {
      console.error("Failed to resolve clarification:", resolveError);
      setInputValue(note);
      setPendingAttachments(attachmentsToUpload);
      setStreamActivities([]);
      alert("Failed to resolve clarification");
    } finally {
      setIsSending(false);
    }
  };

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!project || !event.target.files?.[0]) {
      return;
    }

    setIsUploading(true);
    try {
      await uploadDocument(project.id, event.target.files[0]);
      queryClient.invalidateQueries({
        queryKey: ["projects", project.id, "documents"],
      });
    } catch (uploadError) {
      console.error("Upload failed:", uploadError);
      alert("Failed to upload document");
    } finally {
      setIsUploading(false);
    }
  };

  // Add files to pending attachments (from drag & drop or file picker)
  const handleAddAttachments = (files: FileList | null) => {
    if (!files) return;
    const validTypes = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/gif",
      "image/webp",
      "application/pdf",
    ];
    const newFiles = Array.from(files).filter((file) =>
      validTypes.includes(file.type),
    );
    setPendingAttachments((prev) => [...prev, ...newFiles]);
  };

  // Remove a pending attachment
  const handleRemoveAttachment = (index: number) => {
    setPendingAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // Handle drag events for the prompt box
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleAddAttachments(e.dataTransfer.files);
  };

  const handleDeleteDocument = async (documentId: string) => {
    if (
      !project ||
      !confirm("Are you sure you want to delete this document?")
    ) {
      return;
    }

    try {
      await deleteDocument(project.id, documentId);
      queryClient.invalidateQueries({
        queryKey: ["projects", project.id, "documents"],
      });
    } catch (deleteError) {
      console.error("Delete failed:", deleteError);
      alert("Failed to delete document");
    }
  };

  const handleCreateThread = async (agentType: AgentType) => {
    if (!project) return;
    try {
      const newThread = await createAgentThread(project.id, agentType);
      await queryClient.invalidateQueries({
        queryKey: ["projects", project.id, "threads"],
      });
      setActiveAgent(agentType);
      setActiveThreadId(newThread.id);
    } catch (e) {
      console.error("Failed to create thread:", e);
    }
  };

  const handleRenameThread = async (threadId: string, newTitle: string) => {
    if (!project) return;
    try {
      await renameAgentThread(project.id, threadId, newTitle);
      await queryClient.invalidateQueries({
        queryKey: ["projects", project.id, "threads"],
      });
    } catch (e) {
      console.error("Failed to rename thread:", e);
    }
  };

  const handleDeleteThread = async (threadId: string) => {
    if (!project) return;
    try {
      await deleteAgentThread(project.id, threadId);
      await queryClient.invalidateQueries({
        queryKey: ["projects", project.id, "threads"],
      });
      if (activeThreadId === threadId) {
        setActiveThreadId(null);
      }
    } catch (e) {
      console.error("Failed to delete thread:", e);
    }
  };

  const handleCycleSearch = (direction: "next" | "prev") => {
    if (searchMatches.length === 0) {
      return;
    }

    setActiveSearchIndex((current) => {
      if (direction === "next") {
        return (current + 1) % searchMatches.length;
      }

      return (current - 1 + searchMatches.length) % searchMatches.length;
    });
  };

  const handleExportConversation = () => {
    if (!project) {
      return;
    }

    const activeThread = threads?.find((t) => t.id === activeThreadId);
    const threadTitle = activeThread ? activeThread.title : activeAgentMeta.label;

    const lines = [
      `# ${project.name} - ${threadTitle} (${activeAgentMeta.label})`,
      "",
      `Exported: ${new Date().toLocaleString()}`,
      "",
    ];

    if (messages.length === 0) {
      lines.push("No messages yet.");
    } else {
      messages.forEach((message) => {
        lines.push(
          `## ${message.role === "user" ? "Founder" : activeAgentMeta.label}`,
        );
        lines.push(message.content);
        if (message.citations.length > 0) {
          lines.push("");
          lines.push(`Citations: ${message.citations.join(", ")}`);
        }
        lines.push("");
      });
    }

    const blob = new Blob([lines.join("\n")], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${project.name}-${threadTitle}-conversation.md`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-");
    link.click();
    URL.revokeObjectURL(url);
  };

  if (authLoading || (isLoggedIn && projectsLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#111111]">
        <CircleNotch className="size-5 animate-spin text-white/40" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#111111] px-6 text-center text-sm text-white/58">
        {error instanceof Error
          ? error.message
          : "Failed to load the project workspace."}
      </div>
    );
  }

  if (!project) {
    return null;
  }

  const suggestions = [
    "Give me the sharpest investor-ready positioning for Askelad.",
    "What would an investor challenge first about this startup?",
    "Turn this into a 30-day founder execution plan.",
  ];

  return (
    <div className="h-screen overflow-hidden bg-[#111111] text-white selection:bg-white/10">
      <div className="flex h-full">
        <aside
          className={cn(
            "relative flex h-full shrink-0 flex-col border-r border-white/8 bg-[#101010]/95 backdrop-blur-xl transition-all duration-300",
            isSidebarOpen ? "w-[310px]" : "w-[84px]",
          )}
        >
          <div
            className={cn(
              "px-4 py-4 flex items-center",
              isSidebarOpen ? "justify-end" : "justify-center",
            )}
          >
            <button
              type="button"
              onClick={() => setIsSidebarOpen((current) => !current)}
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-full cursor-pointer text-white/60 transition hover:bg-white/[0.08] hover:text-white"
              aria-label={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
              title={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              {isSidebarOpen ? (
                <CaretDoubleLeft className="size-4" />
              ) : (
                <CaretDoubleRight className="size-4" />
              )}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-4" data-lenis-prevent>
            {isSidebarOpen ? (
              <div className="px-2">
                <button
                  onClick={() =>
                    setIsProjectDropdownOpen(!isProjectDropdownOpen)
                  }
                  className="flex w-full items-center text-left transition hover:opacity-80 cursor-pointer"
                >
                  <span className="text-[15px] font-medium text-white/50">
                    Projects
                  </span>
                  {isProjectDropdownOpen ? (
                    <ChevronDown className="ml-1 size-3.5 text-white/40" />
                  ) : (
                    <ChevronRight className="ml-1 size-3.5 text-white/40" />
                  )}
                </button>

                {isProjectDropdownOpen && (
                  <div className="mt-3">
                    {/* Project list first */}
                    <div className="space-y-0.5">
                      {projects?.map((p) => {
                        const isSelected = p.id === project?.id;
                        const isMenuOpen = projectMenuOpenId === p.id;

                        return (
                          <div
                            key={p.id}
                            className="group relative flex items-center"
                          >
                            <button
                              onClick={() => setSelectedProjectId(p.id)}
                              className={cn(
                                "w-full rounded-lg px-3 py-2 text-left text-sm transition cursor-pointer",
                                isSelected
                                  ? "bg-white/[0.06] text-white/85 font-medium"
                                  : "text-white/40 hover:text-white/60 hover:bg-white/[0.03]",
                              )}
                            >
                              {p.name}
                            </button>

                            {/* ⋯ settings menu */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setProjectMenuOpenId(isMenuOpen ? null : p.id);
                              }}
                              className={cn(
                                "absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-white/20 transition hover:bg-white/[0.08] hover:text-white/50 cursor-pointer",
                                isMenuOpen
                                  ? "opacity-100 bg-white/[0.06] text-white/40"
                                  : "opacity-0 group-hover:opacity-100",
                              )}
                              aria-label={`${p.name} settings`}
                            >
                              <DotsThree className="size-3.5" />
                            </button>

                            {isMenuOpen && (
                              <div className="absolute right-0 top-full z-50 mt-1 min-w-[140px] rounded-lg border border-white/[0.08] bg-[#1a1a1a] p-1 shadow-2xl">
                                <button
                                  onClick={() => {
                                    setProjectMenuOpenId(null);
                                    router.push("/settings");
                                  }}
                                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-white/50 transition hover:bg-white/[0.08] hover:text-white cursor-pointer"
                                >
                                  <Gear className="size-3" />
                                  Project Settings
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* + New Project at bottom */}
                    <button
                      onClick={() => router.push("/onboarding?new=1")}
                      className="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/25 transition hover:text-white/50 hover:bg-white/[0.03] cursor-pointer"
                    >
                      <Plus className="size-3.5" />
                      <span>New Project</span>
                    </button>
                  </div>
                )}
              </div>
            ) : null}

            {/* Divider between projects and agents */}
            {isSidebarOpen && (
              <div className="mx-2 my-4 border-t border-white/[0.06]" />
            )}

            <AgentThreadSidebar
              activeAgent={activeAgent}
              setActiveAgent={setActiveAgent}
              activeThreadId={activeThreadId}
              setActiveThreadId={setActiveThreadId}
              threads={threads ?? []}
              agentSummaryMap={agentSummaryMap}
              isSidebarOpen={isSidebarOpen}
              expandedAgent={expandedAgent}
              setExpandedAgent={setExpandedAgent}
              onCreateThread={handleCreateThread}
              onRenameThread={handleRenameThread}
              onDeleteThread={handleDeleteThread}
            />

            {/* Divider between agents and documents */}
            {isSidebarOpen && (
              <div className="mx-2 my-4 border-t border-white/[0.06]" />
            )}

            {isSidebarOpen && (
              <div>
                {(documents ?? []).length > 0 || isUploading ? (
                  <>
                    <div className="flex items-center justify-between px-2">
                      <p className="text-[10px] uppercase tracking-[0.32em] text-white/26">
                        Documents
                      </p>
                      <label
                        className="inline-flex size-8 cursor-pointer items-center justify-center rounded-full text-white/32 transition hover:bg-white/[0.06] hover:text-white/80"
                        title="Upload document"
                      >
                        <Plus className="size-4" />
                        <input
                          type="file"
                          className="hidden"
                          accept=".pdf,.txt"
                          onChange={handleFileUpload}
                          disabled={isUploading}
                        />
                      </label>
                    </div>

                    <div className="mt-3 space-y-2">
                      {isUploading ? (
                        <div className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-xs text-white/60">
                          <CircleNotch className="size-3.5 animate-spin" />
                          Uploading document...
                        </div>
                      ) : null}

                      {(documents ?? []).map((document) => (
                        <div
                          key={document.id}
                          className="group flex items-center gap-2 rounded-xl border border-transparent bg-transparent px-2 py-2 transition hover:border-white/8 hover:bg-white/[0.04]"
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-white/58 group-hover:text-white/80">
                            <FileText className="size-3.5 shrink-0" />
                            <span
                              className="truncate text-xs"
                              title={document.filename}
                            >
                              {document.filename}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDeleteDocument(document.id)}
                            className="rounded-full p-1 text-white/22 opacity-0 transition group-hover:opacity-100 hover:bg-white/[0.08] hover:text-red-300"
                            aria-label={`Delete ${document.filename}`}
                          >
                            <Trash className="size-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-white/25 transition hover:bg-white/[0.03] hover:text-white/40">
                    <Upload className="size-3.5 shrink-0" />
                    <span className="text-xs">Add context documents</span>
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.txt"
                      onChange={handleFileUpload}
                      disabled={isUploading}
                    />
                  </label>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-white/8 px-3 py-3 relative">
            <button
              type="button"
              onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
              className={cn(
                "flex w-full items-center rounded-[1rem] hover:cursor-pointer transition hover:bg-white/[0.06]",
                isSidebarOpen
                  ? "gap-3 px-2 py-2 text-left"
                  : "justify-center rounded-[1.4rem] px-0 py-2",
              )}
            >
              {user?.picture_url && !profileImageError ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={user.picture_url}
                  alt={user.name || "User"}
                  className="size-8 shrink-0 rounded-full object-cover"
                  onError={() => setProfileImageError(true)}
                />
              ) : (
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-sm font-medium text-white/70 overflow-hidden">
                  {user?.name?.[0]?.toUpperCase() ||
                    user?.email?.[0]?.toUpperCase() ||
                    "U"}
                </div>
              )}
              {isSidebarOpen ? (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white/90">
                    {user?.name || "User"}
                  </p>
                </div>
              ) : null}
            </button>

            {isProfileDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsProfileDropdownOpen(false)}
                />
                <div className="absolute bottom-[110%] left-3 z-50 w-56 rounded-2xl border border-white/10 bg-[#1e1e1e] p-1.5 shadow-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileDropdownOpen(false);
                      router.push("/settings");
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-white/70 transition hover:bg-white/[0.06] hover:text-white/90"
                  >
                    <Gear className="size-4" />
                    Settings
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileDropdownOpen(false);
                      void handleLogout();
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-red-400/80 transition hover:bg-red-400/10 hover:text-red-400"
                  >
                    <SignOut className="size-4" />
                    Log out
                  </button>
                </div>
              </>
            )}
          </div>
        </aside>

        <section className="flex min-w-0 flex-1">
          <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#171717]">
            <header className="border-b border-white/8 px-5 py-4 sm:px-7">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="truncate text-base font-medium text-white/92">
                      {project.name}
                    </h1>
                    <div
                      className={cn(
                        "inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-white/70",
                        activeAgentMeta.bg,
                      )}
                    >
                      <activeAgentMeta.icon
                        className={cn("size-3.5", activeAgentMeta.color)}
                      />
                      {activeAgentMeta.label}
                    </div>
                    {isActiveAgentStreaming && latestActivity ? (
                      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/58">
                        <ActivityIcon tone={latestActivity.tone} />
                        <span className="truncate">{latestActivity.title}</span>
                      </div>
                    ) : null}
                  </div>

                  {streamingRunId &&
                  streamingAgentMeta &&
                  streamingAgentMeta.id !== activeAgent ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/38">
                      <span className="rounded-full border border-amber-400/18 bg-amber-400/8 px-2.5 py-1 text-amber-100/80">
                        {streamingAgentMeta.label} is still replying in the
                        background
                      </span>
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center gap-2 text-sm text-white/42">
                  <button
                    type="button"
                    onClick={() => setIsWorkPanelOpen((current) => !current)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-3 py-2 transition hover:border-white/14 hover:bg-white/[0.06] hover:text-white/74",
                      isWorkPanelOpen
                        ? "border-white/18 bg-white/[0.08] text-white/78"
                        : "border-white/8 bg-white/[0.03]",
                    )}
                  >
                    <FolderOpen className="size-4" />
                    <span className="hidden sm:inline">Work</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenSearch}
                    className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] px-3 py-2 transition hover:border-white/14 hover:bg-white/[0.06] hover:text-white/74"
                  >
                    <MagnifyingGlass className="size-4" />
                    <span className="hidden sm:inline">Search</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportConversation}
                    className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-2 transition hover:border-white/14 hover:bg-white/[0.06] hover:text-white/74"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Download className="size-4" />
                      Export
                    </span>
                  </button>
                </div>
              </div>

              {isSearchOpen ? (
                <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-white/8 bg-white/[0.03] p-2">
                  <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-xl bg-black/20 px-3 py-2">
                    <MagnifyingGlass className="size-4 text-white/36" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          handleCycleSearch(event.shiftKey ? "prev" : "next");
                        }
                      }}
                      placeholder="Search this conversation"
                      className="w-full bg-transparent text-sm text-white placeholder:text-white/24 focus:outline-none"
                    />
                  </div>

                  <div className="inline-flex items-center gap-2 text-xs text-white/40">
                    <span>
                      {searchMatches.length > 0
                        ? `${activeSearchIndex + 1} of ${searchMatches.length}`
                        : searchQuery.trim()
                          ? "No matches"
                          : "Type to search"}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCycleSearch("prev")}
                      disabled={searchMatches.length === 0}
                      className="rounded-full border border-white/8 px-2 py-1 transition hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCycleSearch("next")}
                      disabled={searchMatches.length === 0}
                      className="rounded-full border border-white/8 px-2 py-1 transition hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Next
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsSearchOpen(false);
                        setSearchQuery("");
                        setActiveSearchIndex(0);
                      }}
                      className="inline-flex size-8 items-center justify-center rounded-full border border-white/8 transition hover:bg-white/[0.05]"
                      aria-label="Close search"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                </div>
              ) : null}
            </header>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="flex min-h-0 w-full flex-1 flex-col px-5 pt-4 sm:px-7 lg:px-10">
                <div
                  className="min-h-0 flex-1 overflow-y-auto pr-1"
                  data-lenis-prevent
                >
                  <div className="space-y-7 pb-8 pt-3">
                    {historyLoading ? (
                      <div className="flex justify-center py-20">
                        <CircleNotch className="size-5 animate-spin text-white/18" />
                      </div>
                    ) : messages.length === 0 && !isActiveAgentStreaming ? (
                      <div className="flex min-h-full items-center justify-center py-12">
                        <div className="w-full max-w-4xl">
                          <h2 className="text-[1.9rem] font-semibold tracking-tight text-white">
                            Start a conversation with {activeAgentMeta.label}
                          </h2>
                          <p className="mt-3 max-w-2xl text-sm leading-7 text-white/52">
                            Ask about strategy, execution, growth, or your
                            uploaded project context. The agent will use project
                            files and web research when needed, and you’ll see
                            that progress inline while it works.
                          </p>

                          <div className="mt-6 grid gap-3 sm:grid-cols-3">
                            {suggestions.map((suggestion) => (
                              <button
                                key={suggestion}
                                type="button"
                                onClick={() => setInputValue(suggestion)}
                                className="rounded-2xl border border-white/8 bg-transparent p-4 text-left text-sm leading-6 text-white/68 transition hover:border-white/14 hover:bg-white/[0.03] hover:text-white"
                              >
                                {suggestion}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        {messages.map((message, index) => {
                          const isUser = message.role === "user";

                          return (
                            <div
                              key={message.id}
                              className={cn(
                                "flex",
                                isUser ? "justify-end" : "justify-start",
                              )}
                            >
                              <div
                                ref={(node) => {
                                  messageRefs.current[index] = node;
                                }}
                                className={cn(
                                  "w-full rounded-[1.25rem] transition",
                                  activeSearchMatch === index &&
                                    "bg-white/[0.04]",
                                  isUser && "flex flex-col items-end",
                                )}
                              >
                                <div
                                  className={cn(
                                    "mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.24em]",
                                    isUser
                                      ? "justify-end text-white/28"
                                      : "text-white/34",
                                  )}
                                >
                                  <span className="font-semibold">
                                    {isUser ? "Founder" : activeAgentMeta.label}
                                  </span>
                                  <span className="text-white/16">
                                    {formatMessageTime(message.created_at)}
                                  </span>
                                </div>

                                <article
                                  className={cn(
                                    "px-4 py-3.5",
                                    isUser
                                      ? "rounded-[1.4rem] rounded-br-md bg-[#2a2a2a] text-white"
                                      : "text-white",
                                  )}
                                >
                                  <div
                                    className={cn(
                                      "prose max-w-none text-[15px] leading-7 [&_ol]:my-3 [&_p]:my-0 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:border [&_pre]:p-3 [&_ul]:my-3",
                                      isUser
                                        ? "prose-invert text-white/92 [&_code]:rounded [&_code]:bg-white/10 [&_code]:px-1 [&_code]:py-0.5 [&_pre]:border-white/10 [&_pre]:bg-black/20"
                                        : "prose-invert text-white/82 [&_code]:rounded [&_code]:bg-white/8 [&_code]:px-1 [&_code]:py-0.5 [&_pre]:border-white/8 [&_pre]:bg-black/20",
                                    )}
                                  >
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                      {message.content}
                                    </ReactMarkdown>
                                  </div>

                                  {message.citations.length > 0 ? (
                                    <div className="mt-4 flex flex-wrap gap-2">
                                      {message.citations.map((citation) => (
                                        <span
                                          key={citation}
                                          className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-white/48"
                                        >
                                          {citation}
                                        </span>
                                      ))}
                                    </div>
                                  ) : null}

                                  {/* Display attachments */}
                                  {message.attachments &&
                                    message.attachments.length > 0 && (
                                      <div className="mt-3 flex flex-wrap gap-2">
                                        {message.attachments.map(
                                          (attachment) => (
                                            <a
                                              key={attachment.id}
                                              href={attachment.storage_url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2 hover:bg-white/[0.06]"
                                            >
                                              {attachment.file_type.startsWith(
                                                "image/",
                                              ) ? (
                                                <FileImage className="size-4 shrink-0 text-blue-400" />
                                              ) : (
                                                <FileText className="size-4 shrink-0 text-red-400" />
                                              )}
                                              <span className="max-w-[150px] truncate text-xs text-white/70">
                                                {attachment.filename}
                                              </span>
                                              <Download className="size-3 shrink-0 text-white/40" />
                                            </a>
                                          ),
                                        )}
                                      </div>
                                    )}
                                </article>
                              </div>
                            </div>
                          );
                        })}

                        {isActiveAgentStreaming && streamingAgentMeta ? (
                          <div className="flex justify-start">
                            <div className="w-full">
                              <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-white/34">
                                <span className="font-semibold">
                                  {streamingAgentMeta.label}
                                </span>
                                <span className="inline-flex items-center gap-1.5 text-white/22">
                                  <span className="size-1.5 rounded-full bg-white/40 animate-pulse" />
                                  responding
                                </span>
                              </div>

                              <article className="px-4 py-3.5 text-white">
                                {streamActivities.length > 0 ? (
                                  <div className="mb-4 space-y-1.5 border-l border-white/8 pl-3">
                                    {streamActivities
                                      .slice(-4)
                                      .map((activity) => (
                                        <div
                                          key={activity.id}
                                          className="flex items-center gap-2 text-xs text-white/44"
                                        >
                                          <ActivityIcon tone={activity.tone} />
                                          <span className="trace-shimmer-text truncate">
                                            {activity.title}
                                            {activity.detail
                                              ? ` · ${activity.detail}`
                                              : ""}
                                          </span>
                                        </div>
                                      ))}
                                  </div>
                                ) : null}

                                {streamingContent ? (
                                  <div className="prose prose-invert max-w-none text-[15px] leading-7 text-white/82 [&_code]:rounded [&_code]:bg-white/8 [&_code]:px-1 [&_code]:py-0.5 [&_ol]:my-3 [&_p]:my-0 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-white/8 [&_pre]:bg-black/20 [&_pre]:p-3 [&_ul]:my-3">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                      {streamingContent}
                                    </ReactMarkdown>
                                  </div>
                                ) : (
                                  <p className="text-sm leading-7 text-white/54">
                                    The agent is still working through the
                                    request.
                                  </p>
                                )}
                              </article>
                            </div>
                          </div>
                        ) : null}
                      </>
                    )}

                    <div ref={messagesEndRef} />
                  </div>
                </div>

                <div className="relative pb-4 pt-3 w-[90%] mx-auto">
                  <div
                    className={cn(
                      "border border-white/8 bg-[#1b1b1b] px-3 shadow-[0_-1px_0_rgba(255,255,255,0.02)_inset] transition-all",
                      isDragging && "border-blue-400 bg-blue-950/20",
                      openClarification
                        ? "rounded-[1.5rem] pt-4 pb-2.5"
                        : "rounded-[2rem] py-2.5",
                    )}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    {/* Embedded Action Required UI (Codex style) */}
                    {openClarification && (
                      <div className="mb-4 px-2">
                        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-red-400 mb-2 font-medium">
                          Action required
                        </div>
                        <p className="text-[15px] leading-relaxed text-white/90">
                          {openClarification.question}
                        </p>
                        {openClarification.requested_docs.length > 0 && (
                          <p className="mt-2 text-xs text-white/40">
                            Requested documents:{" "}
                            {openClarification.requested_docs.join(", ")}
                          </p>
                        )}
                        <div className="mt-4 mb-2 h-px w-full bg-white/5" />
                      </div>
                    )}

                    {/* Pending attachments preview */}
                    {pendingAttachments.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-2">
                        {pendingAttachments.map((file, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-1.5 rounded-lg bg-white/8 px-2 py-1.5"
                          >
                            {file.type.startsWith("image/") ? (
                              <FileImage className="size-4 shrink-0 text-blue-400" />
                            ) : (
                              <FileText className="size-4 shrink-0 text-red-400" />
                            )}
                            <span className="max-w-[120px] truncate text-xs text-white/80">
                              {file.name}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveAttachment(index)}
                              className="ml-1 shrink-0 text-white/40 hover:text-white"
                            >
                              <X className="size-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-end gap-2.5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center ml-1">
                        <label className="group relative flex h-full w-full cursor-pointer items-center justify-center text-white/40 transition hover:text-white">
                          <input
                            type="file"
                            className="hidden"
                            accept="image/png,image/jpeg,image/jpg,image/gif,image/webp,application/pdf"
                            onChange={(e) =>
                              handleAddAttachments(e.target.files)
                            }
                          />
                          <Plus className="size-6" />
                          <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-white/10 px-2 py-1 text-[10px] text-white transition-opacity group-hover:block">
                            Add files or images
                          </span>
                        </label>
                      </div>

                      <div className="min-w-0 flex-1 pt-1.5 pb-[7px]">
                        <textarea
                          ref={composerRef}
                          rows={1}
                          value={inputValue}
                          onChange={(event) =>
                            setInputValue(event.target.value)
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter" && !event.shiftKey) {
                              event.preventDefault();
                              if (openClarification) {
                                void handleResolveClarification(
                                  openClarification.id,
                                );
                              } else {
                                void handleSendMessage();
                              }
                            }
                          }}
                          placeholder={
                            openClarification
                              ? "Provide an answer or attach a document..."
                              : `Message ${activeAgentMeta.label}...`
                          }
                          disabled={isSending || !!streamingRunId}
                          className="max-h-[180px] min-h-[24px] w-full resize-none bg-transparent text-[19px] leading-6 text-white placeholder:text-white/26 focus:outline-none disabled:opacity-50 block"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (openClarification) {
                            void handleResolveClarification(
                              openClarification.id,
                            );
                          } else {
                            void handleSendMessage();
                          }
                        }}
                        disabled={
                          isSending ||
                          !!streamingRunId ||
                          (!inputValue.trim() &&
                            pendingAttachments.length === 0)
                        }
                        className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-black transition hover:opacity-94 disabled:cursor-not-allowed disabled:bg-white/12 disabled:text-white/22"
                        aria-label="Send message"
                      >
                        {isSending || !!streamingRunId ? (
                          <CircleNotch className="size-6 animate-spin" />
                        ) : (
                          <ArrowUp className="size-6" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {isWorkPanelOpen ? (
            <FounderWorkPanel
              projectId={project.id}
              onClose={() => setIsWorkPanelOpen(false)}
            />
          ) : null}
        </section>
      </div>
    </div>
  );
}
