"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle, CircleNotch, Lightning } from "@phosphor-icons/react";

import { useAuth } from "@/hooks/useAuth";
import {
  getWorkspaceSettings,
  saveProviderKey,
  testProviderKey,
  updateWorkspaceSettings,
  type ProviderName,
} from "@/lib/settings";
import { cn } from "@/lib/utils";

const PROVIDERS: Array<{
  id: ProviderName;
  label: string;
  placeholder: string;
}> = [
  { id: "openai", label: "OpenAI", placeholder: "sk-..." },
  { id: "anthropic", label: "Anthropic", placeholder: "sk-ant-..." },
  { id: "xai", label: "xAI / Grok", placeholder: "xai-..." },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [providerDrafts, setProviderDrafts] = useState<Record<ProviderName, string>>({
    openai: "",
    anthropic: "",
    xai: "",
  });
  const [defaultProviderDraft, setDefaultProviderDraft] =
    useState<ProviderName | null>(null);
  const [defaultModelDraft, setDefaultModelDraft] = useState<string | null>(null);
  const [platformFallbackDraft, setPlatformFallbackDraft] = useState<boolean | null>(
    null,
  );
  const [monthlyLimitDraft, setMonthlyLimitDraft] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["workspace-settings"],
    queryFn: getWorkspaceSettings,
  });

  const defaultProvider =
    defaultProviderDraft ?? settings?.default_provider ?? "openai";
  const defaultModel = defaultModelDraft ?? settings?.default_model ?? "gpt-5.4-mini";
  const platformFallback =
    platformFallbackDraft ?? settings?.platform_key_fallback ?? true;
  const monthlyLimit =
    monthlyLimitDraft ?? settings?.monthly_prompt_limit?.toString() ?? "";

  const settingsMutation = useMutation({
    mutationFn: () =>
      updateWorkspaceSettings({
        default_provider: defaultProvider,
        default_model: defaultModel,
        platform_key_fallback: platformFallback,
        monthly_prompt_limit: monthlyLimit ? Number(monthlyLimit) : null,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workspace-settings"] }),
  });

  const keyMutation = useMutation({
    mutationFn: ({ provider, apiKey }: { provider: ProviderName; apiKey: string }) =>
      saveProviderKey(provider, apiKey),
    onSuccess: (_, variables) => {
      setProviderDrafts((current) => ({ ...current, [variables.provider]: "" }));
      queryClient.invalidateQueries({ queryKey: ["workspace-settings"] });
    },
  });

  const testMutation = useMutation({
    mutationFn: ({ provider, apiKey }: { provider: ProviderName; apiKey?: string }) =>
      testProviderKey(provider, defaultModel, apiKey),
    onSuccess: (result) => {
      setTestResult(`${result.provider}: ${result.message}`);
      queryClient.invalidateQueries({ queryKey: ["workspace-settings"] });
    },
    onError: (error) => {
      setTestResult(error instanceof Error ? error.message : "Connection failed.");
    },
  });

  const providerKeyMap = new Map(
    settings?.provider_keys.map((providerKey) => [providerKey.provider, providerKey]) ?? [],
  );
  const used = settings?.used_prompts ?? 0;
  const limit =
    settings?.monthly_prompt_limit ??
    (settings?.plan_prompt_limit === -1 ? null : settings?.plan_prompt_limit);

  return (
    <main className="min-h-screen bg-[#111111] text-white">
      <div className="px-6 py-8 sm:px-12 lg:px-24">
        <Link
          href="/project"
          className="inline-flex items-center gap-2 text-sm text-white/40 transition hover:text-white"
        >
          <ArrowLeft className="size-4" />
          Back to workspace
        </Link>
      </div>

      <div className="mx-auto max-w-3xl px-6 pb-24">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-medium tracking-tight text-white/90">
              Settings
            </h1>
            <p className="mt-2 text-base text-white/40">
              Provider keys, default model, and workspace limits.
            </p>
          </div>
          <button
            onClick={() => settingsMutation.mutate()}
            disabled={settingsMutation.isPending}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-medium text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {settingsMutation.isPending ? "Saving..." : "Save changes"}
          </button>
        </div>

        {isLoading ? (
          <div className="mt-16 flex justify-center">
            <CircleNotch className="size-5 animate-spin text-white/28" />
          </div>
        ) : (
          <div className="mt-12 space-y-12">
            <section>
              <h2 className="text-sm font-medium uppercase tracking-widest text-white/30">
                Runtime
              </h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm text-white/70">
                    Default provider
                  </span>
                  <select
                    value={defaultProvider}
                    onChange={(event) =>
                      setDefaultProviderDraft(event.target.value as ProviderName)
                    }
                    className="w-full cursor-pointer rounded-xl border border-white/10 bg-[#1a1a1a] px-4 py-3 text-sm text-white focus:border-white/30 focus:outline-none"
                  >
                    {PROVIDERS.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm text-white/70">
                    Default model
                  </span>
                  <input
                    type="text"
                    value={defaultModel}
                    onChange={(event) => setDefaultModelDraft(event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white focus:border-white/30 focus:outline-none"
                  />
                </label>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] p-4">
                  <input
                    type="checkbox"
                    checked={platformFallback}
                    onChange={(event) =>
                      setPlatformFallbackDraft(event.target.checked)
                    }
                    className="size-4 accent-white"
                  />
                  <span className="text-sm text-white/62">
                    Use platform key fallback
                  </span>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm text-white/70">
                    Monthly prompt limit
                  </span>
                  <input
                    type="number"
                    min={1}
                    value={monthlyLimit}
                    onChange={(event) => setMonthlyLimitDraft(event.target.value)}
                    placeholder="Plan default"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white placeholder:text-white/20 focus:border-white/30 focus:outline-none"
                  />
                </label>
              </div>
              <div className="mt-4 rounded-xl border border-white/8 bg-white/[0.02] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-white/28">
                  Usage
                </p>
                <p className="mt-2 text-sm text-white/62">
                  {used} prompt{used === 1 ? "" : "s"} used
                  {limit ? ` of ${limit}` : ""}.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-sm font-medium uppercase tracking-widest text-white/30">
                Encrypted Provider Keys
              </h2>
              <div className="mt-6 space-y-4">
                {PROVIDERS.map((provider) => {
                  const saved = providerKeyMap.get(provider.id);
                  const draft = providerDrafts[provider.id];
                  return (
                    <div
                      key={provider.id}
                      className="rounded-2xl border border-white/8 bg-white/[0.02] p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-white/90">
                            {provider.label}
                          </p>
                          <p className="mt-1 text-xs text-white/40">
                            {saved
                              ? `${saved.key_hint} · ${saved.status}`
                              : "No key saved"}
                          </p>
                        </div>
                        {saved?.status === "valid" ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/18 px-2 py-1 text-xs text-emerald-100/70">
                            <CheckCircle className="size-3.5" />
                            Valid
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                        <input
                          type="password"
                          value={draft}
                          onChange={(event) =>
                            setProviderDrafts((current) => ({
                              ...current,
                              [provider.id]: event.target.value,
                            }))
                          }
                          placeholder={provider.placeholder}
                          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-white/20 focus:border-white/30 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            keyMutation.mutate({
                              provider: provider.id,
                              apiKey: draft,
                            })
                          }
                          disabled={!draft || keyMutation.isPending}
                          className="cursor-pointer rounded-xl border border-white/10 px-4 py-3 text-sm text-white/62 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Save key
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            testMutation.mutate({
                              provider: provider.id,
                              apiKey: draft || undefined,
                            })
                          }
                          disabled={testMutation.isPending || (!draft && !saved)}
                          className={cn(
                            "inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm transition disabled:cursor-not-allowed disabled:opacity-40",
                            "bg-white text-black hover:bg-white/90",
                          )}
                        >
                          <Lightning className="size-4" />
                          Test
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              {testResult ? (
                <p className="mt-4 rounded-xl border border-white/8 bg-white/[0.02] p-4 text-sm text-white/58">
                  {testResult}
                </p>
              ) : null}
            </section>

            <section>
              <h2 className="text-sm font-medium uppercase tracking-widest text-white/30">
                Profile
              </h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <ReadOnlyField label="Name" value={user?.name || ""} />
                <ReadOnlyField label="Email" value={user?.email || ""} />
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-white/70">{label}</span>
      <input
        type="text"
        value={value}
        readOnly
        className="w-full cursor-not-allowed rounded-xl border border-white/10 bg-transparent px-4 py-3 text-sm text-white/50 focus:outline-none"
      />
    </label>
  );
}
