"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function SettingsPage() {
  const { user } = useAuth();

  const [openAiKey, setOpenAiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [grokKey, setGrokKey] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => setIsSaving(false), 800);
  };

  return (
    <main className="min-h-screen bg-[#111111] text-white">
      {/* Top Navigation for Back Button - Anchored to the far left */}
      <div className="px-6 py-8 sm:px-12 lg:px-24">
        <Link
          href="/project"
          className="inline-flex items-center gap-2 text-sm text-white/40 transition hover:text-white"
        >
          <ArrowLeft className="size-4" />
          Back to workspace
        </Link>
      </div>

      {/* Main Settings Content - Centered */}
      <div className="mx-auto max-w-2xl px-6 pb-24">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-medium tracking-tight text-white/90">
              Settings
            </h1>
            <p className="mt-2 text-base text-white/40">
              Manage your account and workspace preferences.
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-medium text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save changes"}
          </button>
        </div>

        <div className="mt-12 space-y-14">
          {/* Profile Section */}
          <section>
            <h2 className="text-sm font-medium uppercase tracking-widest text-white/30">
              Profile
            </h2>
            <div className="mt-6 space-y-5">
              <div>
                <label className="mb-2 block text-sm text-white/70">Name</label>
                <input
                  type="text"
                  value={user?.name || ""}
                  readOnly
                  className="w-full rounded-xl border border-white/10 bg-transparent px-4 py-3 text-sm text-white/50 focus:outline-none cursor-not-allowed"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm text-white/70">
                  Email
                </label>
                <input
                  type="email"
                  value={user?.email || ""}
                  readOnly
                  className="w-full rounded-xl border border-white/10 bg-transparent px-4 py-3 text-sm text-white/50 focus:outline-none cursor-not-allowed"
                />
              </div>
              <p className="text-xs text-white/40">
                Your profile information is synced securely from your Google
                account.
              </p>
            </div>
          </section>

          {/* API Keys Section */}
          <section>
            <h2 className="text-sm font-medium uppercase tracking-widest text-white/30">
              API Keys (BYO Key)
            </h2>
            <div className="mt-6 space-y-5">
              <p className="text-sm leading-relaxed text-white/50 mb-6">
                Bring your own provider keys for Grok, Claude, or OpenAI. These
                are stored securely and routed through LiteLLM.
              </p>

              <div>
                <label className="mb-2 block text-sm text-white/70">
                  OpenAI API Key
                </label>
                <input
                  type="password"
                  value={openAiKey}
                  onChange={(e) => setOpenAiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white placeholder:text-white/20 focus:border-white/30 focus:outline-none transition"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm text-white/70">
                  Anthropic API Key
                </label>
                <input
                  type="password"
                  value={anthropicKey}
                  onChange={(e) => setAnthropicKey(e.target.value)}
                  placeholder="sk-ant-..."
                  className="w-full rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white placeholder:text-white/20 focus:border-white/30 focus:outline-none transition"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm text-white/70">
                  xAI (Grok) API Key
                </label>
                <input
                  type="password"
                  value={grokKey}
                  onChange={(e) => setGrokKey(e.target.value)}
                  placeholder="xai-..."
                  className="w-full rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white placeholder:text-white/20 focus:border-white/30 focus:outline-none transition"
                />
              </div>
            </div>
          </section>

          {/* Workspace Data */}
          <section>
            <h2 className="text-sm font-medium uppercase tracking-widest text-white/30">
              Workspace Data
            </h2>
            <div className="mt-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-white/8 bg-white/[0.02] p-5">
                <div>
                  <p className="text-sm font-medium text-white/90">
                    Export Conversation
                  </p>
                  <p className="text-sm text-white/40 mt-1">
                    Download your workspace history as a markdown file.
                  </p>
                </div>
                <Link
                  href="/project"
                  className="inline-flex shrink-0 items-center justify-center rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20"
                >
                  Go to Project
                </Link>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-red-500/20 bg-red-500/5 p-5">
                <div>
                  <p className="text-sm font-medium text-red-400">
                    Danger Zone
                  </p>
                  <p className="text-sm text-red-400/60 mt-1">
                    Permanently delete your workspace and all data.
                  </p>
                </div>
                <button className="inline-flex shrink-0 items-center justify-center rounded-full bg-red-500/20 px-4 py-2 text-sm font-medium text-red-400 transition hover:bg-red-500/30">
                  Delete Workspace
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
