import Link from 'next/link';
import { ArrowLeft, Settings } from 'lucide-react';

export default function SettingsPage() {
  return (
    <main className="min-h-screen bg-[#111111] px-6 py-10 text-white sm:px-10">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/project"
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/70 transition hover:bg-white/[0.06] hover:text-white"
        >
          <ArrowLeft className="size-4" />
          Back to project
        </Link>

        <div className="mt-8 rounded-[1.8rem] border border-white/10 bg-[#171717] p-8">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-white/[0.05]">
              <Settings className="size-5 text-white/78" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-white">Settings</h1>
              <p className="mt-1 text-sm text-white/48">Workspace and account controls for Askelad.</p>
            </div>
          </div>

          <div className="mt-8 space-y-4">
            <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
              <h2 className="text-sm font-medium text-white">Workspace settings</h2>
              <p className="mt-2 text-sm leading-7 text-white/52">
                This page is now connected. Next, we can add project editing, API key management, and export defaults
                here instead of leaving the sidebar button inactive.
              </p>
            </section>

            <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
              <h2 className="text-sm font-medium text-white">What’s ready</h2>
              <p className="mt-2 text-sm leading-7 text-white/52">
                Search and export in the project view are live. This settings route gives us a dedicated place to add
                actual workspace controls next.
              </p>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
