import { apiFetch } from './api';

export type ProviderName = 'openai' | 'anthropic' | 'xai';
export type ProviderStatus = 'untested' | 'valid' | 'invalid';

export interface ProviderKeyState {
  provider: ProviderName;
  key_hint: string;
  status: ProviderStatus;
  last_tested_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceSettings {
  default_provider: ProviderName;
  default_model: string;
  platform_key_fallback: boolean;
  monthly_prompt_limit: number | null;
  plan_prompt_limit: number;
  used_prompts: number;
  provider_keys: ProviderKeyState[];
}

export interface SettingsUpdatePayload {
  default_provider?: ProviderName;
  default_model?: string;
  platform_key_fallback?: boolean;
  monthly_prompt_limit?: number | null;
}

export interface ProviderKeyTestResponse {
  ok: boolean;
  provider: ProviderName;
  model: string;
  message: string;
}

export async function getWorkspaceSettings(): Promise<WorkspaceSettings> {
  return apiFetch<WorkspaceSettings>('/settings');
}

export async function updateWorkspaceSettings(
  payload: SettingsUpdatePayload
): Promise<WorkspaceSettings> {
  return apiFetch<WorkspaceSettings>('/settings', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function saveProviderKey(
  provider: ProviderName,
  apiKey: string
): Promise<ProviderKeyState> {
  return apiFetch<ProviderKeyState>(`/settings/provider-keys/${provider}`, {
    method: 'PUT',
    body: JSON.stringify({ api_key: apiKey }),
  });
}

export async function testProviderKey(
  provider: ProviderName,
  model?: string,
  apiKey?: string
): Promise<ProviderKeyTestResponse> {
  return apiFetch<ProviderKeyTestResponse>(
    `/settings/provider-keys/${provider}/test`,
    {
      method: 'POST',
      body: JSON.stringify({ model, api_key: apiKey || undefined }),
    }
  );
}
