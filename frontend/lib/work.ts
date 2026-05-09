import { apiFetch } from './api';
import type { AgentType } from './agents';

export type TaskStatus =
  | 'todo'
  | 'in_progress'
  | 'blocked'
  | 'waiting_for_user'
  | 'done'
  | 'archived';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type ArtifactFormat = 'markdown' | 'csv' | 'pdf' | 'text';
export type DigestCadence = 'daily' | 'weekly';
export type MonitorType = 'market' | 'competitor' | 'follow_up' | 'risk';
export type MonitorStatus = 'active' | 'paused';

export interface Task {
  id: string;
  project_id: string;
  source_run_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  owner_agent_type: AgentType | null;
  due_at: string | null;
  blocked_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskCreatePayload {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  owner_agent_type?: AgentType | null;
  due_at?: string | null;
  blocked_reason?: string | null;
}

export type TaskUpdatePayload = Partial<TaskCreatePayload>;

export interface TaskEvent {
  id: string;
  task_id: string;
  project_id: string;
  actor_type: 'founder' | 'agent' | 'cofounder' | 'system';
  actor_label: string | null;
  event_type: string;
  summary: string;
  metadata_json: Record<string, unknown>;
  created_at: string;
}

export interface AgentRunStep {
  id: string;
  run_id: string;
  project_id: string;
  agent_type: AgentType;
  sequence: number;
  event_type: string;
  title: string;
  detail: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface ArtifactVersion {
  id: string;
  artifact_id: string;
  version: number;
  content: string;
  metadata_json: Record<string, unknown>;
  created_by: string;
  created_at: string;
}

export interface Artifact {
  id: string;
  project_id: string;
  task_id: string | null;
  run_id: string | null;
  title: string;
  artifact_type: string;
  format: ArtifactFormat;
  current_version_id: string | null;
  created_at: string;
  updated_at: string;
  current_version: ArtifactVersion | null;
}

export interface ArtifactCreatePayload {
  title: string;
  artifact_type:
    | 'competitor_analysis'
    | 'pricing_model'
    | 'investor_update'
    | 'landing_page_copy'
    | 'roadmap'
    | 'general';
  format: ArtifactFormat;
  content: string;
  task_id?: string | null;
  metadata_json?: Record<string, unknown>;
}

export interface WorkQueue {
  today: Task[];
  blocked: Task[];
  waiting_for_you: Task[];
  upcoming: Task[];
  recent_artifacts: Artifact[];
  recent_steps: AgentRunStep[];
  unresolved_clarifications: number;
  stale_task_count: number;
}

export interface CofounderDigest {
  id: string;
  project_id: string;
  cadence: DigestCadence;
  title: string;
  summary: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface CofounderMonitor {
  id: string;
  project_id: string;
  title: string;
  monitor_type: MonitorType;
  query: string;
  cadence: DigestCadence;
  status: MonitorStatus;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MonitorCreatePayload {
  title: string;
  monitor_type: MonitorType;
  query: string;
  cadence: DigestCadence;
}

export async function getWorkQueue(projectId: string): Promise<WorkQueue> {
  return apiFetch<WorkQueue>(`/projects/${projectId}/work-queue`);
}

export async function listTasks(projectId: string): Promise<Task[]> {
  return apiFetch<Task[]>(`/projects/${projectId}/tasks`);
}

export async function createTask(
  projectId: string,
  payload: TaskCreatePayload
): Promise<Task> {
  return apiFetch<Task>(`/projects/${projectId}/tasks`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateTask(
  projectId: string,
  taskId: string,
  payload: TaskUpdatePayload
): Promise<Task> {
  return apiFetch<Task>(`/projects/${projectId}/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function listArtifacts(projectId: string): Promise<Artifact[]> {
  return apiFetch<Artifact[]>(`/projects/${projectId}/artifacts`);
}

export async function createArtifact(
  projectId: string,
  payload: ArtifactCreatePayload
): Promise<Artifact> {
  return apiFetch<Artifact>(`/projects/${projectId}/artifacts`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function listDigests(projectId: string): Promise<CofounderDigest[]> {
  return apiFetch<CofounderDigest[]>(`/projects/${projectId}/cofounder/digests`);
}

export async function createDigest(
  projectId: string,
  cadence: DigestCadence
): Promise<CofounderDigest> {
  return apiFetch<CofounderDigest>(`/projects/${projectId}/cofounder/digests`, {
    method: 'POST',
    body: JSON.stringify({ cadence }),
  });
}

export async function listMonitors(projectId: string): Promise<CofounderMonitor[]> {
  return apiFetch<CofounderMonitor[]>(`/projects/${projectId}/cofounder/monitors`);
}

export async function createMonitor(
  projectId: string,
  payload: MonitorCreatePayload
): Promise<CofounderMonitor> {
  return apiFetch<CofounderMonitor>(`/projects/${projectId}/cofounder/monitors`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
