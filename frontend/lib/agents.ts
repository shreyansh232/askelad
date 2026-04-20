import { apiFetch, buildHeaders } from './api';

// ─── Types ───────────────────────────────────────────────────────────────────

export type AgentType = 'cofounder' | 'finance' | 'marketing' | 'product';
export type AgentRunStatus = 'pending' | 'running' | 'completed' | 'needs_clarification' | 'failed';
export type ClarificationStatus = 'open' | 'resolved';
export type AgentMessageRole = 'user' | 'assistant';

export interface AgentMessage {
  id: string;
  run_id: string | null;
  role: AgentMessageRole;
  content: string;
  citations: string[];
  created_at: string;
}

export interface ClarificationRequest {
  id: string;
  run_id: string;
  agent_type: AgentType;
  question: string;
  requested_docs: string[];
  status: ClarificationStatus;
  resolution_note: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface AgentRun {
  id: string;
  thread_id: string;
  agent_type: AgentType;
  status: AgentRunStatus;
  model_name: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface AgentMessageCreateResponse {
  run: AgentRun;
  user_message: AgentMessage;
}

export interface AgentHistoryResponse {
  thread_id: string;
  agent_type: AgentType;
  messages: AgentMessage[];
  clarifications: ClarificationRequest[];
}

export interface AgentSummaryItem {
  agent_type: AgentType;
  latest_run: AgentRun | null;
  unresolved_clarifications: number;
}

export interface AgentSummaryResponse {
  project_id: string;
  agents: AgentSummaryItem[];
}

export interface AgentStreamEvent {
  event: string;
  data: Record<string, unknown>;
}

// ─── API Calls ───────────────────────────────────────────────────────────────

export async function createAgentMessage(
  projectId: string,
  agentType: AgentType,
  content: string
): Promise<AgentMessageCreateResponse> {
  return apiFetch<AgentMessageCreateResponse>(`/projects/${projectId}/agents/${agentType}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

export async function listAgentMessages(
  projectId: string,
  agentType: AgentType
): Promise<AgentHistoryResponse> {
  return apiFetch<AgentHistoryResponse>(`/projects/${projectId}/agents/${agentType}/messages`);
}

export async function getAgentSummary(projectId: string): Promise<AgentSummaryResponse> {
  return apiFetch<AgentSummaryResponse>(`/projects/${projectId}/agents/summary`);
}

export async function listProjectClarifications(
  projectId: string,
  status: 'open' | 'resolved' | 'all' = 'open'
): Promise<ClarificationRequest[]> {
  return apiFetch<ClarificationRequest[]>(`/projects/${projectId}/clarifications?status=${status}`);
}

export async function resolveClarification(
  projectId: string,
  clarificationId: string,
  resolutionNote: string
): Promise<ClarificationRequest> {
  return apiFetch<ClarificationRequest>(`/projects/${projectId}/clarifications/${clarificationId}/resolve`, {
    method: 'POST',
    body: JSON.stringify({ resolution_note: resolutionNote }),
  });
}

/**
 * SSE helper for streaming agent responses using fetch.
 * This handles Authorization headers which standard EventSource does not.
 */
export async function streamAgentRun(
  projectId: string,
  agentType: AgentType,
  runId: string,
  onEvent: (event: string, data: AgentStreamEvent['data']) => void,
  onAbort?: (controller: AbortController) => void
): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
  const url = `${baseUrl}/projects/${projectId}/agents/${agentType}/stream?run_id=${runId}`;

  const controller = new AbortController();
  if (onAbort) onAbort(controller);

  const response = await fetch(url, {
    headers: buildHeaders(),
    signal: controller.signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to start stream: ${response.statusText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      
      // SSE events are separated by double newlines
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || ''; // Keep the incomplete last chunk in buffer

      for (const line of lines) {
        if (!line.trim()) continue;
        
        const eventMatch = line.match(/^event: (.*)$/m);
        const dataMatch = line.match(/^data: (.*)$/m);

        if (eventMatch && dataMatch) {
          const event = eventMatch[1];
          try {
            const data = JSON.parse(dataMatch[1]);
            onEvent(event, data);
          } catch (e) {
            console.error('Failed to parse SSE data:', e, dataMatch[1]);
          }
        }
      }
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.log('Stream aborted');
    } else {
      throw error;
    }
  } finally {
    reader.releaseLock();
  }
}
