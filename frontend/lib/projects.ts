import { apiFetch } from './api';

// ─── Types ───────────────────────────────────────────────────────────────────
// Mirrors backend schemas/projects.py

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  industry: string | null;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  project_id: string;
  filename: string;
  file_type: string;
  storage_url: string;
  created_at: string;
}

export interface ProjectCreatePayload {
  name: string;
  description?: string;
  industry?: string;
}

export interface ProjectUpdatePayload {
  name?: string;
  description?: string;
  industry?: string;
}

// ─── API calls ───────────────────────────────────────────────────────────────

export async function createProject(payload: ProjectCreatePayload | FormData): Promise<Project> {
  let body: FormData;
  if (payload instanceof FormData) {
    body = payload;
  } else {
    body = new FormData();
    body.append('name', payload.name);
    if (payload.description) body.append('description', payload.description);
    if (payload.industry) body.append('industry', payload.industry);
  }
  
  return apiFetch<Project>('/projects/', {
    method: 'POST',
    body,
  });
}

export async function listProjects(): Promise<Project[]> {
  return apiFetch<Project[]>('/projects/');
}

export async function getProject(id: string): Promise<Project> {
  return apiFetch<Project>(`/projects/${id}`);
}

export async function updateProject(id: string, payload: ProjectUpdatePayload): Promise<Project> {
  return apiFetch<Project>(`/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteProject(id: string): Promise<void> {
  return apiFetch<void>(`/projects/${id}`, { method: 'DELETE' });
}

export async function listDocuments(projectId: string): Promise<Document[]> {
  return apiFetch<Document[]>(`/projects/${projectId}/documents`);
}

export async function uploadDocument(projectId: string, file: File): Promise<Document> {
  const formData = new FormData();
  formData.append('file', file);
  
  return apiFetch<Document>(`/projects/${projectId}/documents`, {
    method: 'POST',
    body: formData,
  });
}

export async function deleteDocument(projectId: string, documentId: string): Promise<void> {
  return apiFetch<void>(`/projects/${projectId}/documents/${documentId}`, {
    method: 'DELETE',
  });
}
