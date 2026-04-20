'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowUp,
  BookText,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  FolderOpen,
  Globe,
  Loader2,
  Megaphone,
  MessageSquareText,
  PencilLine,
  Plus,
  Search,
  Settings,
  Sparkles,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import {
  createAgentMessage,
  listAgentMessages,
  resolveClarification,
  streamAgentRun,
  type AgentMessage,
  type AgentType,
  type ClarificationRequest,
} from '@/lib/agents';
import {
  deleteDocument,
  listDocuments,
  listProjects,
  uploadDocument,
  type Project,
} from '@/lib/projects';
import { cn } from '@/lib/utils';

const AGENTS = [
  { id: 'cofounder' as const, label: 'Co-Founder', icon: MessageSquareText },
  { id: 'finance' as const, label: 'Finance', icon: Wallet },
  { id: 'marketing' as const, label: 'Marketing', icon: Megaphone },
  { id: 'product' as const, label: 'Product', icon: PencilLine },
] as const;

type ActivityTone = 'neutral' | 'context' | 'search' | 'draft' | 'error';

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
    hour: '2-digit',
    minute: '2-digit',
  });
}

function summarizeDocumentNames(documentNames: string[]) {
  if (documentNames.length === 0) {
    return 'No uploaded documents yet. Using project details only.';
  }

  if (documentNames.length <= 3) {
    return documentNames.join(' • ');
  }

  return `${documentNames.slice(0, 3).join(' • ')} +${documentNames.length - 3} more`;
}

function getStringValue(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function getStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
}

function getRecordValue(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function upsertActivity(activities: StreamActivity[], nextActivity: StreamActivity) {
  const index = activities.findIndex((activity) => activity.id === nextActivity.id);

  if (index === -1) {
    return [...activities, nextActivity];
  }

  const next = [...activities];
  next[index] = nextActivity;
  return next;
}

function ActivityIcon({ tone }: { tone: ActivityTone }) {
  const className = 'size-3.5';

  if (tone === 'context') {
    return <BookText className={className} />;
  }

  if (tone === 'search') {
    return <Globe className={className} />;
  }

  if (tone === 'error') {
    return <ChevronRight className={className} />;
  }

  if (tone === 'draft') {
    return <Sparkles className={className} />;
  }

  return <Loader2 className={`${className} animate-spin`} />;
}

export default function ProjectPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const messageRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const { isLoading: authLoading, isLoggedIn } = useAuth();

  const [activeAgent, setActiveAgent] = useState<AgentType>('cofounder');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingRunId, setStreamingRunId] = useState<string | null>(null);
  const [streamingAgent, setStreamingAgent] = useState<AgentType | null>(null);
  const [streamActivities, setStreamActivities] = useState<StreamActivity[]>([]);
  const [clarificationDrafts, setClarificationDrafts] = useState<Record<string, string>>({});
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);

  const {
    data: projects,
    isLoading: projectsLoading,
    error,
  } = useQuery({
    queryKey: ['projects', 'list'],
    queryFn: listProjects,
    enabled: isLoggedIn,
  });

  const project = useMemo<Project | null>(() => {
    if (!projects || projects.length === 0) {
      return null;
    }

    return projects[0];
  }, [projects]);

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['projects', project?.id, 'agents', activeAgent, 'messages'],
    queryFn: () => listAgentMessages(project!.id, activeAgent),
    enabled: !!project,
  });

  const { data: documents } = useQuery({
    queryKey: ['projects', project?.id, 'documents'],
    queryFn: () => listDocuments(project!.id),
    enabled: !!project,
  });

  const messages = useMemo(() => history?.messages ?? [], [history]);
  const clarifications = useMemo(() => history?.clarifications ?? [], [history]);
  const activeAgentMeta = getAgentMeta(activeAgent);
  const streamingAgentMeta = streamingAgent ? getAgentMeta(streamingAgent) : null;
  const isActiveAgentStreaming = !!streamingRunId && streamingAgent === activeAgent;
  const latestActivity = streamActivities[streamActivities.length - 1];
  const documentNames = useMemo(
    () => (documents ?? []).map((document) => document.filename),
    [documents]
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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

    setActiveSearchIndex((current) => Math.min(current, searchMatches.length - 1));
  }, [searchMatches]);

  useEffect(() => {
    if (activeSearchMatch === null) {
      return;
    }

    messageRefs.current[activeSearchMatch]?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }, [activeSearchMatch]);

  useEffect(() => {
    const composer = composerRef.current;
    if (!composer) {
      return;
    }

    composer.style.height = '0px';
    composer.style.height = `${Math.min(composer.scrollHeight, 220)}px`;
  }, [inputValue]);

  useEffect(() => {
    if (!project || !streamingRunId || !streamingAgent) {
      return;
    }

    let controller: AbortController | null = null;

    const startStream = async () => {
      try {
        await streamAgentRun(
          project.id,
          streamingAgent,
          streamingRunId,
          (event, data) => {
            if (event === 'run.started') {
              setStreamActivities([
                {
                  id: 'intake',
                  title: 'Thinking',
                  detail: 'Understanding your request',
                  tone: 'neutral',
                },
              ]);
              return;
            }

            if (event === 'run.context_loaded') {
              const contextDocuments =
                getStringArray(data.documents).length > 0
                  ? getStringArray(data.documents)
                  : documentNames;

              setStreamActivities((current) =>
                upsertActivity(current, {
                  id: 'context',
                  title: contextDocuments.length > 0 ? 'Exploring project files' : 'Reviewing project brief',
                  detail:
                    contextDocuments.length > 0
                      ? summarizeDocumentNames(contextDocuments)
                      : 'Using project details only',
                  tone: 'context',
                })
              );
              return;
            }

            if (event === 'tool.called') {
              const argumentsValue = getRecordValue(data.arguments);
              const toolName = getStringValue(data.tool_name, 'tool');
              const query = getStringValue(argumentsValue?.query, 'Searching the web');
              const searchDepth =
                getStringValue(argumentsValue?.search_depth) === 'advanced' ? 'Advanced depth' : 'Quick scan';

              setStreamActivities((current) =>
                upsertActivity(current, {
                  id: `tool-${toolName}-${query}`,
                  title: toolName === 'web_search' ? `Searching for "${query}"` : `Running ${toolName}`,
                  detail:
                    toolName === 'web_search' ? searchDepth : JSON.stringify(argumentsValue ?? {}),
                  tone: 'search',
                })
              );
              return;
            }

            if (event === 'tool.completed') {
              const toolName = getStringValue(data.tool_name, 'tool');

              setStreamActivities((current) =>
                upsertActivity(current, {
                  id: `tool-result-${toolName}`,
                  title: toolName === 'web_search' ? 'Search results ready' : `${toolName} finished`,
                  detail: getStringValue(data.summary, 'Tool execution completed.'),
                  tone: 'search',
                })
              );
              return;
            }

            if (event === 'clarification.detected') {
              setStreamActivities((current) =>
                upsertActivity(current, {
                  id: 'clarification',
                  title: 'Needs more input',
                  detail: getStringValue(
                    data.question,
                    'The agent needs clarification before it can finish.'
                  ),
                  tone: 'error',
                })
              );
              return;
            }

            if (event === 'message.delta') {
              setStreamingContent((current) => current + (data.delta ?? data.content ?? ''));
              setStreamActivities((current) =>
                upsertActivity(current, {
                  id: 'drafting',
                  title: 'Writing response',
                  detail: 'Turning findings into an answer',
                  tone: 'draft',
                })
              );
              return;
            }

            if (event === 'run.completed' || event === 'run.failed') {
              const streamedAgent = streamingAgent;

              setStreamingRunId(null);
              setStreamingAgent(null);
              setStreamingContent('');
              setStreamActivities([]);

              queryClient.invalidateQueries({
                queryKey: ['projects', project.id, 'agents', streamedAgent, 'messages'],
              });
            }
          },
          (nextController) => {
            controller = nextController;
          }
        );
      } catch (streamError) {
        console.error('Streaming failed:', streamError);
        setStreamingRunId(null);
        setStreamingAgent(null);
        setStreamingContent('');
        setStreamActivities([]);
      }
    };

    startStream();

    return () => {
      controller?.abort();
    };
  }, [documentNames, project, queryClient, streamingAgent, streamingRunId]);

  useEffect(() => {
    if (!authLoading && !isLoggedIn) {
      router.replace('/login');
    }
  }, [authLoading, isLoggedIn, router]);

  useEffect(() => {
    if (!authLoading && isLoggedIn && !projectsLoading && !error && !project) {
      router.replace('/onboarding');
    }
  }, [authLoading, error, isLoggedIn, project, projectsLoading, router]);

  const handleSendMessage = async () => {
    if (!project || !inputValue.trim() || isSending || !!streamingRunId) {
      return;
    }

    const content = inputValue.trim();
    setInputValue('');
    setIsSending(true);
    setStreamingContent('');
    setStreamActivities([
      {
        id: 'intake',
        title: 'Thinking',
        detail: 'Understanding your request',
        tone: 'neutral',
      },
    ]);

    try {
      const response = await createAgentMessage(project.id, activeAgent, content);

      queryClient.setQueryData(
        ['projects', project.id, 'agents', activeAgent, 'messages'],
        (old: { messages?: AgentMessage[]; clarifications?: ClarificationRequest[] } | undefined) => ({
          ...old,
          messages: [...(old?.messages ?? []), response.user_message],
          clarifications: old?.clarifications ?? [],
        })
      );

      setStreamingAgent(activeAgent);
      setStreamingRunId(response.run.id);
    } catch (sendError) {
      console.error('Failed to send message:', sendError);
      setInputValue(content);
      setStreamActivities([]);
      alert('Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const handleResolveClarification = async (clarificationId: string) => {
    if (!project) {
      return;
    }

    const note = clarificationDrafts[clarificationId]?.trim();
    if (!note) {
      return;
    }

    try {
      await resolveClarification(project.id, clarificationId, note);
      setClarificationDrafts((current) => {
        const next = { ...current };
        delete next[clarificationId];
        return next;
      });
      queryClient.invalidateQueries({
        queryKey: ['projects', project.id, 'agents', activeAgent, 'messages'],
      });
    } catch (resolveError) {
      console.error('Failed to resolve clarification:', resolveError);
      alert('Failed to resolve clarification');
    }
  };

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!project || !event.target.files?.[0]) {
      return;
    }

    setIsUploading(true);
    try {
      await uploadDocument(project.id, event.target.files[0]);
      queryClient.invalidateQueries({ queryKey: ['projects', project.id, 'documents'] });
    } catch (uploadError) {
      console.error('Upload failed:', uploadError);
      alert('Failed to upload document');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    if (!project || !confirm('Are you sure you want to delete this document?')) {
      return;
    }

    try {
      await deleteDocument(project.id, documentId);
      queryClient.invalidateQueries({ queryKey: ['projects', project.id, 'documents'] });
    } catch (deleteError) {
      console.error('Delete failed:', deleteError);
      alert('Failed to delete document');
    }
  };

  const handleOpenSearch = () => {
    if (!isSearchOpen) {
      setIsSearchOpen(true);
      return;
    }

    if (searchMatches.length > 0) {
      setActiveSearchIndex((current) => (current + 1) % searchMatches.length);
      return;
    }

    searchInputRef.current?.focus();
  };

  const handleCycleSearch = (direction: 'next' | 'prev') => {
    if (searchMatches.length === 0) {
      return;
    }

    setActiveSearchIndex((current) => {
      if (direction === 'next') {
        return (current + 1) % searchMatches.length;
      }

      return (current - 1 + searchMatches.length) % searchMatches.length;
    });
  };

  const handleExportConversation = () => {
    if (!project) {
      return;
    }

    const lines = [
      `# ${project.name} - ${activeAgentMeta.label} conversation`,
      '',
      `Exported: ${new Date().toLocaleString()}`,
      '',
    ];

    if (messages.length === 0) {
      lines.push('No messages yet.');
    } else {
      messages.forEach((message) => {
        lines.push(`## ${message.role === 'user' ? 'Founder' : activeAgentMeta.label}`);
        lines.push(message.content);
        if (message.citations.length > 0) {
          lines.push('');
          lines.push(`Citations: ${message.citations.join(', ')}`);
        }
        lines.push('');
      });
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${project.name}-${activeAgentMeta.id}-conversation.md`
      .toLowerCase()
      .replace(/\s+/g, '-');
    link.click();
    URL.revokeObjectURL(url);
  };

  if (authLoading || (isLoggedIn && projectsLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#111111]">
        <Loader2 className="size-5 animate-spin text-white/40" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#111111] px-6 text-center text-sm text-white/58">
        {error instanceof Error ? error.message : 'Failed to load the project workspace.'}
      </div>
    );
  }

  if (!project) {
    return null;
  }

  const suggestions = [
    'Give me the sharpest investor-ready positioning for Askelad.',
    'What would an investor challenge first about this startup?',
    'Turn this into a 30-day founder execution plan.',
  ];

  return (
    <div className="h-screen overflow-hidden bg-[#111111] text-white selection:bg-white/10">
      <div className="flex h-full">
        <aside
          className={cn(
            'relative flex h-full shrink-0 flex-col border-r border-white/8 bg-[#101010]/95 backdrop-blur-xl transition-all duration-300',
            isSidebarOpen ? 'w-[280px]' : 'w-[84px]'
          )}
        >
          <div
            className={cn(
              'border-b border-white/8 px-4 py-4',
              isSidebarOpen ? 'flex items-center justify-between' : 'flex flex-col items-center gap-3'
            )}
          >
            <Button
              asChild
              variant="secondary"
              className={cn(
                'h-11 rounded-[1rem] border border-white/10 bg-white/[0.04] text-sm font-medium text-white shadow-none hover:bg-white/[0.08]',
                isSidebarOpen ? 'w-full justify-start px-4' : 'size-14 justify-center rounded-[1.25rem] px-0'
              )}
            >
              <Link href="/onboarding" title="New project">
                <FolderOpen className="size-4 shrink-0" />
                {isSidebarOpen && <span>New project</span>}
              </Link>
            </Button>

            <button
              type="button"
              onClick={() => setIsSidebarOpen((current) => !current)}
              className={cn(
                'inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white/60 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white',
                isSidebarOpen ? 'ml-3' : ''
              )}
              aria-label={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
              title={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              {isSidebarOpen ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-4" data-lenis-prevent>
            <div
              className={cn(
                'rounded-[1.4rem] border border-white/8 bg-white/[0.03] p-4',
                !isSidebarOpen && 'flex items-center justify-center rounded-[1.7rem] p-3'
              )}
            >
              {isSidebarOpen ? (
                <>
                  <p className="text-[10px] uppercase tracking-[0.32em] text-white/35">Project</p>
                  <h2 className="mt-4 text-[1.35rem] font-semibold text-white">{project.name}</h2>
                  <p className="mt-3 text-sm leading-6 text-white/48">
                    {project.description || 'Shared startup context ready for your AI operating team.'}
                  </p>
                </>
              ) : (
                <div className="flex size-12 items-center justify-center rounded-2xl bg-white/[0.06] text-lg font-semibold text-white">
                  {project.name.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>

            <div className="mt-5">
              <div className={cn('flex items-center justify-between px-2', !isSidebarOpen && 'justify-center')}>
                {isSidebarOpen ? (
                  <p className="text-[10px] uppercase tracking-[0.32em] text-white/26">Documents</p>
                ) : null}
                <label
                  className={cn(
                    'inline-flex cursor-pointer items-center justify-center rounded-full text-white/32 transition hover:bg-white/[0.06] hover:text-white/80',
                    isSidebarOpen ? 'size-8' : 'size-10'
                  )}
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
                    <Loader2 className="size-3.5 animate-spin" />
                    {isSidebarOpen ? 'Uploading document...' : null}
                  </div>
                ) : null}

                {(documents ?? []).length === 0 && !isUploading ? (
                  <p
                    className={cn(
                      'rounded-xl px-3 py-2 text-xs italic text-white/24',
                      !isSidebarOpen && 'text-center text-[11px]'
                    )}
                  >
                    {isSidebarOpen ? 'No documents yet.' : '0'}
                  </p>
                ) : null}

                {(documents ?? []).map((document) => (
                  <div
                    key={document.id}
                    className={cn(
                      'group flex items-center gap-2 rounded-xl border border-transparent bg-transparent px-2 py-2 transition hover:border-white/8 hover:bg-white/[0.04]',
                      !isSidebarOpen && 'justify-center rounded-full px-0 py-0'
                    )}
                  >
                    <div
                      className={cn(
                        'flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-white/58 group-hover:text-white/80',
                        !isSidebarOpen && 'size-10 flex-none justify-center rounded-full bg-white/[0.04]'
                      )}
                    >
                      <FileText className="size-3.5 shrink-0" />
                      {isSidebarOpen ? (
                        <span className="truncate text-xs" title={document.filename}>
                          {document.filename}
                        </span>
                      ) : null}
                    </div>

                    {isSidebarOpen ? (
                      <button
                        type="button"
                        onClick={() => handleDeleteDocument(document.id)}
                        className="rounded-full p-1 text-white/22 opacity-0 transition group-hover:opacity-100 hover:bg-white/[0.08] hover:text-red-300"
                        aria-label={`Delete ${document.filename}`}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <nav className="mt-6">
              <div className="space-y-2">
                {AGENTS.map((agent) => {
                  const Icon = agent.icon;
                  const isActive = activeAgent === agent.id;

                  return (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={() => setActiveAgent(agent.id)}
                    className={cn(
                        'flex w-full items-center rounded-[1.1rem] border text-left transition',
                        isSidebarOpen ? 'gap-3 px-3 py-3' : 'justify-center rounded-[1.4rem] px-0 py-2.5',
                        isActive
                          ? 'border-white/12 bg-white/[0.09] text-white shadow-[0_12px_30px_rgba(0,0,0,0.18)]'
                          : 'border-transparent text-white/52 hover:border-white/8 hover:bg-white/[0.05] hover:text-white/88'
                      )}
                      title={agent.label}
                    >
                      <div
                        className={cn(
                          'flex shrink-0 items-center justify-center',
                          isSidebarOpen ? 'size-9 rounded-2xl' : 'size-11 rounded-full',
                          isActive ? 'bg-white/[0.08]' : 'bg-white/[0.04]'
                        )}
                      >
                        <Icon className="size-4" />
                      </div>

                      {isSidebarOpen ? (
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{agent.label}</p>
                          <p className="truncate text-xs text-white/32">
                            {agent.id === 'finance'
                              ? 'Cash, runway, and metrics'
                              : agent.id === 'marketing'
                                ? 'Positioning and growth'
                                : agent.id === 'product'
                                  ? 'Roadmap and customer value'
                                  : 'Strategic founder guidance'}
                          </p>
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </nav>
          </div>

          <div className="border-t border-white/8 px-3 py-3">
            <button
              type="button"
              onClick={() => router.push('/settings')}
              className={cn(
                'flex w-full items-center rounded-[1rem] border border-white/8 bg-white/[0.03] text-white/54 transition hover:bg-white/[0.06] hover:text-white/84',
                isSidebarOpen ? 'gap-3 px-3 py-3' : 'justify-center rounded-[1.4rem] px-0 py-3'
              )}
              title="Settings"
            >
              <Settings className="size-4 shrink-0" />
              {isSidebarOpen ? (
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium">Settings</p>
                  <p className="text-[10px] uppercase tracking-[0.28em] text-white/26">Workspace</p>
                </div>
              ) : null}
            </button>
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#171717]">
            <header className="border-b border-white/8 px-5 py-4 sm:px-7">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="truncate text-base font-medium text-white/92">{project.name}</h1>
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-white/70">
                      <activeAgentMeta.icon className="size-3.5" />
                      {activeAgentMeta.label}
                    </div>
                    {isActiveAgentStreaming && latestActivity ? (
                      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/58">
                        <ActivityIcon tone={latestActivity.tone} />
                        <span className="truncate">{latestActivity.title}</span>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/38">
                    <span className="rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-1">
                      {(documents ?? []).length} document{(documents ?? []).length === 1 ? '' : 's'}
                    </span>
                    <span className="rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-1">
                      Founder + {activeAgentMeta.label} conversation
                    </span>
                    {streamingRunId && streamingAgentMeta && streamingAgentMeta.id !== activeAgent ? (
                      <span className="rounded-full border border-amber-400/18 bg-amber-400/8 px-2.5 py-1 text-amber-100/80">
                        {streamingAgentMeta.label} is still replying in the background
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm text-white/42">
                  <button
                    type="button"
                    onClick={handleOpenSearch}
                    className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] px-3 py-2 transition hover:border-white/14 hover:bg-white/[0.06] hover:text-white/74"
                  >
                    <Search className="size-4" />
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
                    <Search className="size-4 text-white/36" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          handleCycleSearch(event.shiftKey ? 'prev' : 'next');
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
                          ? 'No matches'
                          : 'Type to search'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCycleSearch('prev')}
                      disabled={searchMatches.length === 0}
                      className="rounded-full border border-white/8 px-2 py-1 transition hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCycleSearch('next')}
                      disabled={searchMatches.length === 0}
                      className="rounded-full border border-white/8 px-2 py-1 transition hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Next
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsSearchOpen(false);
                        setSearchQuery('');
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
                <div className="min-h-0 flex-1 overflow-y-auto pr-1" data-lenis-prevent>
                  <div className="space-y-7 pb-8 pt-3">
                    {historyLoading ? (
                      <div className="flex justify-center py-20">
                        <Loader2 className="size-5 animate-spin text-white/18" />
                      </div>
                    ) : messages.length === 0 && !isActiveAgentStreaming ? (
                      <div className="flex min-h-full items-center justify-center py-12">
                        <div className="w-full max-w-4xl">
                          <h2 className="text-[1.9rem] font-semibold tracking-tight text-white">
                            Start a conversation with {activeAgentMeta.label}
                          </h2>
                          <p className="mt-3 max-w-2xl text-sm leading-7 text-white/52">
                            Ask about strategy, execution, growth, or your uploaded project context. The agent will use
                            project files and web research when needed, and you’ll see that progress inline while it works.
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
                          const isUser = message.role === 'user';

                          return (
                            <div key={message.id} className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
                              <div
                                ref={(node) => {
                                  messageRefs.current[index] = node;
                                }}
                                className={cn(
                                  'w-full rounded-[1.25rem] transition',
                                  activeSearchMatch === index && 'bg-white/[0.04]',
                                  isUser && 'flex flex-col items-end'
                                )}
                              >
                                <div
                                  className={cn(
                                    'mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.24em]',
                                    isUser ? 'justify-end text-white/28' : 'text-white/34'
                                  )}
                                >
                                  <span className="font-semibold">
                                    {isUser ? 'Founder' : activeAgentMeta.label}
                                  </span>
                                  <span className="text-white/16">{formatMessageTime(message.created_at)}</span>
                                </div>

                                <article
                                  className={cn(
                                    'px-4 py-3.5',
                                    isUser
                                      ? 'rounded-[1.4rem] rounded-br-md bg-[#2a2a2a] text-white'
                                      : 'text-white'
                                  )}
                                >
                                  <div
                                    className={cn(
                                      'prose max-w-none text-[15px] leading-7 [&_ol]:my-3 [&_p]:my-0 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:border [&_pre]:p-3 [&_ul]:my-3',
                                      isUser
                                        ? 'prose-invert text-white/92 [&_code]:rounded [&_code]:bg-white/10 [&_code]:px-1 [&_code]:py-0.5 [&_pre]:border-white/10 [&_pre]:bg-black/20'
                                        : 'prose-invert text-white/82 [&_code]:rounded [&_code]:bg-white/8 [&_code]:px-1 [&_code]:py-0.5 [&_pre]:border-white/8 [&_pre]:bg-black/20'
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
                                </article>
                              </div>
                            </div>
                          );
                        })}

                        {isActiveAgentStreaming && streamingAgentMeta ? (
                          <div className="flex justify-start">
                            <div className="w-full">
                              <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-white/34">
                                <span className="font-semibold">{streamingAgentMeta.label}</span>
                                <span className="inline-flex items-center gap-1.5 text-white/22">
                                  <span className="size-1.5 rounded-full bg-white/40 animate-pulse" />
                                  responding
                                </span>
                              </div>

                              <article className="px-4 py-3.5 text-white">
                                {streamActivities.length > 0 ? (
                                  <div className="mb-4 space-y-1.5 border-l border-white/8 pl-3">
                                    {streamActivities.slice(-4).map((activity) => (
                                      <div key={activity.id} className="flex items-center gap-2 text-xs text-white/44">
                                        <ActivityIcon tone={activity.tone} />
                                        <span className="trace-shimmer-text truncate">
                                          {activity.title}
                                          {activity.detail ? ` · ${activity.detail}` : ''}
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
                                    The agent is still working through the request.
                                  </p>
                                )}
                              </article>
                            </div>
                          </div>
                        ) : null}

                        {clarifications
                          .filter((clarification) => clarification.status === 'open')
                          .map((clarification) => (
                            <div
                              key={clarification.id}
                              className="rounded-[1.6rem] border border-blue-400/16 bg-blue-400/7 p-5 shadow-[0_18px_40px_rgba(0,0,0,0.14)]"
                            >
                              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-blue-100/72">
                                <Sparkles className="size-3.5" />
                                Action required
                              </div>
                              <p className="mt-4 text-sm leading-7 text-white/86">{clarification.question}</p>
                              {clarification.requested_docs.length > 0 ? (
                                <p className="mt-3 text-xs text-white/50">
                                  Helpful documents: {clarification.requested_docs.join(', ')}
                                </p>
                              ) : null}

                              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                                <input
                                  type="text"
                                  value={clarificationDrafts[clarification.id] ?? ''}
                                  onChange={(event) =>
                                    setClarificationDrafts((current) => ({
                                      ...current,
                                      [clarification.id]: event.target.value,
                                    }))
                                  }
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                      void handleResolveClarification(clarification.id);
                                    }
                                  }}
                                  placeholder="Type your answer..."
                                  className="h-12 flex-1 rounded-2xl border border-white/10 bg-black/20 px-4 text-sm text-white placeholder:text-white/22 focus:border-blue-400/30 focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => void handleResolveClarification(clarification.id)}
                                  disabled={!clarificationDrafts[clarification.id]?.trim()}
                                  className="inline-flex h-12 items-center justify-center rounded-2xl bg-white px-5 text-sm font-medium text-black transition hover:opacity-92 disabled:cursor-not-allowed disabled:bg-white/12 disabled:text-white/22"
                                >
                                  Provide answer
                                </button>
                              </div>
                            </div>
                          ))}
                      </>
                    )}

                    <div ref={messagesEndRef} />
                  </div>
                </div>

                <div className="relative pb-4 pt-3">
                  <div className="rounded-[1.6rem] border border-white/8 bg-[#1b1b1b] px-3 py-2.5 shadow-[0_-1px_0_rgba(255,255,255,0.02)_inset]">
                    <div className="flex items-end gap-3">
                      <div className="min-w-0 flex-1 px-1 py-1">
                        <textarea
                          ref={composerRef}
                          rows={1}
                          value={inputValue}
                          onChange={(event) => setInputValue(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' && !event.shiftKey) {
                              event.preventDefault();
                              void handleSendMessage();
                            }
                          }}
                          placeholder={`Message ${activeAgentMeta.label}...`}
                          disabled={isSending || !!streamingRunId}
                          className="max-h-[180px] min-h-[24px] w-full resize-none bg-transparent text-[15px] leading-6 text-white placeholder:text-white/26 focus:outline-none disabled:opacity-50"
                        />

                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-white/24">
                          <span>Enter to send</span>
                          <span>{activeAgentMeta.label} can use files and web research</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => void handleSendMessage()}
                        disabled={isSending || !!streamingRunId || !inputValue.trim()}
                        className="mb-1 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-black transition hover:opacity-94 disabled:cursor-not-allowed disabled:bg-white/12 disabled:text-white/22"
                        aria-label="Send message"
                      >
                        {isSending || !!streamingRunId ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <ArrowUp className="size-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
