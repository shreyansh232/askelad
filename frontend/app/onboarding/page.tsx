'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Loader2, Upload, X } from 'lucide-react';

import { useAuth } from '@/hooks/useAuth';
import { createProject, listProjects } from '@/lib/projects';
import { Button } from '@/components/ui/button';

const INDUSTRIES = [
  'SaaS / Software',
  'Fintech',
  'E-commerce',
  'Healthcare',
  'EdTech',
  'Marketing & Media',
  'Developer Tools',
  'AI / ML',
  'Logistics',
  'Consumer',
  'Other',
] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isLoading, isLoggedIn } = useAuth();
  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects', 'list'],
    queryFn: listProjects,
    enabled: isLoggedIn,
  });

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [industry, setIndustry] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Redirect unauthenticated users to login
  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      router.replace('/login');
    }
  }, [isLoading, isLoggedIn, router]);

  const existingProject = useMemo(() => projects?.[0] ?? null, [projects]);

  useEffect(() => {
    if (!isLoading && !projectsLoading && existingProject) {
      router.replace('/project');
    }
  }, [existingProject, isLoading, projectsLoading, router]);

  if (isLoading || (isLoggedIn && projectsLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-5 animate-spin text-foreground/40" />
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      if (description.trim()) formData.append('description', description.trim());
      if (industry) formData.append('industry', industry);
      
      files.forEach((file) => {
        formData.append('files', file);
      });

      const project = await createProject(formData);
      queryClient.setQueryData(['projects', 'list'], [project]);
      router.push('/project');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:72px_72px] opacity-25" />
        <div className="absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.07),rgba(255,255,255,0)_65%)]" />
      </div>

      {/* Logo */}
      <span className="pointer-events-none fixed top-6 right-6 z-20 text-sm font-medium tracking-[0.22em] text-foreground/70 uppercase sm:top-8 sm:right-8">
        Askelad
      </span>

      <main className="relative flex min-h-screen flex-col items-center justify-center px-6 py-20">
        {/* Eyebrow */}
        <p className="text-[10px] tracking-[0.32em] text-foreground/30 uppercase mb-5">
          Step 1 of 1
        </p>

        <h1 className="font-mono text-[clamp(1.8rem,3.5vw,2.6rem)] leading-tight tracking-[-0.04em] text-foreground text-center max-w-[18ch]">
          Tell us about your startup
        </h1>
        <p className="mt-3 text-[0.9rem] text-foreground/44 text-center max-w-[44ch] leading-relaxed">
          This gives your AI team the context they need from day one.
        </p>

        {/* Form card */}
        <form
          onSubmit={handleSubmit}
          className="mt-10 w-full max-w-[440px] rounded-[1.75rem] border border-white/[0.09] bg-white/[0.025] p-8 sm:p-9"
        >
          {/* Project name */}
          <div>
            <label
              htmlFor="name"
              className="block text-[10px] tracking-[0.2em] text-foreground/40 uppercase mb-2"
            >
              Project name <span className="text-foreground/25">*</span>
            </label>
            <input
              id="name"
              type="text"
              required
              maxLength={255}
              placeholder="e.g. Askelad, Rocketly, PriceBot"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-[0.75rem] border border-white/[0.1] bg-white/[0.04] px-4 py-3 text-sm text-foreground placeholder:text-foreground/24 outline-none transition-colors focus:border-white/25 focus:bg-white/[0.06]"
            />
          </div>

          {/* One-liner */}
          <div className="mt-5">
            <label
              htmlFor="description"
              className="block text-[10px] tracking-[0.2em] text-foreground/40 uppercase mb-2"
            >
              One-liner
            </label>
            <input
              id="description"
              type="text"
              maxLength={200}
              placeholder="What do you do, in one sentence?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-[0.75rem] border border-white/[0.1] bg-white/[0.04] px-4 py-3 text-sm text-foreground placeholder:text-foreground/24 outline-none transition-colors focus:border-white/25 focus:bg-white/[0.06]"
            />
          </div>

          {/* Industry */}
          <div className="mt-5">
            <label
              htmlFor="industry"
              className="block text-[10px] tracking-[0.2em] text-foreground/40 uppercase mb-2"
            >
              Industry
            </label>
            <select
              id="industry"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="w-full rounded-[0.75rem] border border-white/[0.1] bg-[#1a1a1a] px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-white/25 appearance-none cursor-pointer"
            >
              <option value="" className="text-foreground/40">
                Select industry…
              </option>
              {INDUSTRIES.map((ind) => (
                <option key={ind} value={ind}>
                  {ind}
                </option>
              ))}
            </select>
          </div>

          {/* Documents Upload */}
          <div className="mt-5">
            <label className="block text-[10px] tracking-[0.2em] text-foreground/40 uppercase mb-2">
              Context Documents <span className="text-[9px] lowercase opacity-60">(optional)</span>
            </label>
            <div className="relative">
              <input
                id="files"
                type="file"
                multiple
                accept=".pdf,.txt"
                onChange={handleFileChange}
                className="hidden"
              />
              <label
                htmlFor="files"
                className="flex cursor-pointer items-center justify-center gap-2 rounded-[0.75rem] border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 transition-colors hover:border-white/20 hover:bg-white/[0.04]"
              >
                <Upload className="size-4 text-foreground/40" />
                <span className="text-sm text-foreground/50">Upload pitch deck, business plan...</span>
              </label>
            </div>
            
            {files.length > 0 && (
              <div className="mt-3 space-y-2">
                {files.map((file, i) => (
                  <div key={i} className="flex items-center justify-between rounded-[0.5rem] bg-white/[0.04] px-3 py-2 text-xs text-foreground/70">
                    <span className="truncate max-w-[200px]">{file.name}</span>
                    <button type="button" onClick={() => removeFile(i)} className="text-foreground/30 hover:text-red-400">
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-2 text-[9px] text-foreground/30 italic">
              PDF and TXT supported. These will be used to train your agents.
            </p>
          </div>

          {/* Error */}
          {error && (
            <p className="mt-4 text-xs text-red-400/80">{error}</p>
          )}

          {/* Submit */}
          <Button
            type="submit"
            disabled={submitting || !name.trim()}
            className="mt-8 flex h-[52px] w-full items-center justify-center gap-2 rounded-[0.9rem] bg-white px-5 text-sm font-medium text-black transition-all hover:bg-white/90 active:scale-[0.99] disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                Launch my AI team
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </form>

        <p className="mt-6 text-[11px] text-foreground/24 text-center">
          You can update these details any time from settings.
        </p>
      </main>
    </div>
  );
}
