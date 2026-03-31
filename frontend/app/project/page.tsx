'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  FolderOpen,
  Loader2,
  MessageSquareText,
  Megaphone,
  PencilLine,
  Search,
  Settings,
  Plus,
  Wallet,
  X,
  Trash2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { listProjects, listDocuments, uploadDocument, deleteDocument, type Project, type Document } from '@/lib/projects';

const AGENTS = [
  { id: 'cofounder', label: 'Co-Founder', icon: MessageSquareText },
  { id: 'finance', label: 'Finance', icon: Wallet },
  { id: 'marketing', label: 'Marketing', icon: Megaphone },
  { id: 'product', label: 'Product', icon: PencilLine },
] as const;

const MESSAGES = [
  {
    id: 'm1',
    tone: 'body',
    content:
      'The cofounder layer keeps product, growth, and finance working from the same project context, then asks for clarification before the work drifts.',
  },
  {
    id: 'm2',
    tone: 'body',
    content:
      'Start by anchoring your startup basics in onboarding. Once the context is solid, the specialist agents can work from the same operating memory.',
  }
] as const;

export default function ProjectPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isLoading: authLoading, isLoggedIn } = useAuth();
  const [activeAgent, setActiveAgent] = useState<(typeof AGENTS)[number]['id']>('cofounder');
  const [isUploading, setIsUploading] = useState(false);

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

  const { data: documents } = useQuery({
    queryKey: ['projects', project?.id, 'documents'],
    queryFn: () => listDocuments(project!.id),
    enabled: !!project,
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!project || !e.target.files?.[0]) return;
    
    setIsUploading(true);
    try {
      await uploadDocument(project.id, e.target.files[0]);
      queryClient.invalidateQueries({ queryKey: ['projects', project.id, 'documents'] });
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Failed to upload document');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!project || !confirm('Are you sure you want to delete this document?')) return;
    
    try {
      await deleteDocument(project.id, docId);
      queryClient.invalidateQueries({ queryKey: ['projects', project.id, 'documents'] });
    } catch (err) {
      console.error('Delete failed:', err);
      alert('Failed to delete document');
    }
  };

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

  if (authLoading || (isLoggedIn && projectsLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#171717]">
        <Loader2 className="size-5 animate-spin text-white/40" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#171717] px-6 text-center text-sm text-white/58">
        {error instanceof Error ? error.message : 'Failed to load the project workspace.'}
      </div>
    );
  }

  if (!project) {
    return null;
  }

  const activeAgentMeta = AGENTS.find((agent) => agent.id === activeAgent) ?? AGENTS[0];

  return (
    <div className="min-h-screen bg-[#171717] text-white">
      <div className="grid min-h-screen lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="flex min-h-screen flex-col border-r border-white/8 bg-[#141414]">
          <div className="border-b border-white/8 px-5 py-5">
            <Button
              asChild
              variant="secondary"
              className="h-12 w-full justify-start rounded-[1rem] border border-white/8 bg-[#1b1b1b] px-4 text-sm font-medium text-white shadow-none hover:bg-[#222222]"
            >
              <Link href="/onboarding">
                <FolderOpen className="size-4" />
                New project
              </Link>
            </Button>
          </div>

          <div className="px-6 pt-8">
            <p className="text-[11px] tracking-[0.22em] text-white/34 uppercase">Project</p>
            <div className="mt-5">
              <p className="text-xl font-medium text-white">{project.name}</p>
              <p className="mt-2 text-sm leading-7 text-white/42">
                {project.description || 'Shared startup context ready for your operating team.'}
              </p>
            </div>

            {documents && (
              <div className="mt-8">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] tracking-[0.22em] text-white/20 uppercase">Documents</p>
                  <label className="cursor-pointer text-white/20 hover:text-white/60 transition-colors">
                    <Plus className="size-3" />
                    <input 
                      type="file" 
                      className="hidden" 
                      accept=".pdf,.txt"
                      onChange={handleFileUpload}
                      disabled={isUploading}
                    />
                  </label>
                </div>
                
                <div className="mt-4 space-y-1">
                  {isUploading && (
                    <div className="flex items-center gap-3 px-2 py-1.5 text-white/24 animate-pulse">
                      <Loader2 className="size-3.5 animate-spin" />
                      <span className="text-xs italic">Uploading...</span>
                    </div>
                  )}
                  
                  {documents.length === 0 && !isUploading && (
                    <p className="px-2 py-1.5 text-[11px] text-white/14 italic">No documents yet.</p>
                  )}

                  {documents.map((doc) => (
                    <div key={doc.id} className="group flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-white/[0.03]">
                      <div className="flex items-center gap-3 text-white/44 group-hover:text-white/70 overflow-hidden">
                        <FileText className="size-3.5 shrink-0 opacity-40" />
                        <span className="truncate text-xs cursor-default" title={doc.filename}>
                          {doc.filename}
                        </span>
                      </div>
                      <button 
                        onClick={() => handleDeleteDocument(doc.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-white/20 hover:text-red-400 transition-all"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <nav className="mt-8 px-3">
            <div className="space-y-1">
              {AGENTS.map((agent) => {
                const Icon = agent.icon;
                const isActive = activeAgent === agent.id;

                return (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => setActiveAgent(agent.id)}
                    className={`flex w-full items-center gap-3 rounded-[1rem] px-4 py-3 text-left text-sm transition-colors ${
                      isActive
                        ? 'bg-[#232323] text-white'
                        : 'text-white/52 hover:bg-[#1b1b1b] hover:text-white/88'
                    }`}
                  >
                    <Icon className="size-4" />
                    {agent.label}
                  </button>
                );
              })}
            </div>
          </nav>

          <div className="mt-auto border-t border-white/8 px-4 py-4">
            <div className="flex items-center justify-between rounded-[1rem] bg-[#171717] px-3 py-3 text-white/44">
              <button type="button" className="inline-flex items-center gap-2 text-sm hover:text-white/80">
                <Settings className="size-4" />
                Settings
              </button>
              <span className="text-[10px] tracking-[0.18em] uppercase">Workspace</span>
            </div>
          </div>
        </aside>

        <section className="flex min-h-screen flex-col bg-[#1a1a1a]">
          <header className="flex items-center justify-between border-b border-white/8 px-5 py-4 sm:px-7">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-white/90">{project.name}</span>
              <span className="text-white/18">•</span>
              <span className="text-sm text-white/48">{activeAgentMeta.label}</span>
            </div>

            <div className="flex items-center gap-5 text-sm text-white/38">
              <button type="button" className="inline-flex items-center gap-2 hover:text-white/72">
                <Search className="size-4" />
                Search
              </button>
              <button type="button" className="hover:text-white/72">
                Copy chat
              </button>
              <button type="button" className="hover:text-white/72">
                Export
              </button>
            </div>
          </header>

          <div className="flex-1 px-5 pb-5 pt-7 sm:px-7">
            <div className="mx-auto flex h-full max-w-4xl flex-col">
              <div className="flex-1 overflow-y-auto rounded-[1.4rem] border border-white/8 bg-[#1d1d1d] px-6 py-6 sm:px-8">
                <div className="space-y-7">
                  {MESSAGES.map((message) => (
                    <div key={message.id}>
                        <p className="max-w-3xl text-[1.02rem] leading-9 text-white/74">
                          {message.content}
                        </p>
                    </div>
                  ))}

                  <div className="rounded-[1rem] border border-white/8 bg-[#171717] px-4 py-4 text-sm leading-7 text-white/56">
                    This workspace view is a first-pass shell. The live agent chat stream,
                    task state, and citations can be layered in next.
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-[1.4rem] border border-white/8 bg-[#1d1d1d] px-4 py-3">
                <div className="flex items-end gap-3">
                  <textarea
                    rows={1}
                    placeholder={`Message ${activeAgentMeta.label}...`}
                    className="min-h-[52px] flex-1 resize-none bg-transparent px-1 py-3 text-sm text-white placeholder:text-white/26 focus:outline-none"
                  />
                  <button
                    type="button"
                    className="mb-2 inline-flex h-10 items-center justify-center rounded-full bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-white/92"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
