import {
  UploadedFile,
  MatchingJob,
  ColumnMapping,
  MatchingWeights,
  MatchingThresholds,
  JobProgressResponse,
  MatchedResultRow
} from './types';

const BASE_URL = '/api/v1';

export async function uploadFile(file: File): Promise<UploadedFile> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${BASE_URL}/files/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to upload file');
  }

  return res.json();
}

export async function getFile(fileId: string): Promise<UploadedFile> {
  const res = await fetch(`${BASE_URL}/files/${fileId}`);
  if (!res.ok) throw new Error('Failed to fetch file');
  return res.json();
}

export async function deleteFile(fileId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/files/${fileId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete file');
}

export async function createJob(data: { name: string; file_a_id: string; file_b_id: string }): Promise<MatchingJob> {
  const res = await fetch(`${BASE_URL}/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to create job');
  }

  return res.json();
}

export async function getJobs(): Promise<{
  metrics: {
    total_jobs: number;
    completed_jobs: number;
    processing_jobs: number;
    failed_jobs: number;
  };
  jobs: MatchingJob[];
}> {
  const res = await fetch(`${BASE_URL}/jobs`);
  if (!res.ok) throw new Error('Failed to fetch jobs');
  return res.json();
}

export async function getJob(jobId: string): Promise<MatchingJob> {
  const res = await fetch(`${BASE_URL}/jobs/${jobId}`);
  if (!res.ok) throw new Error('Failed to fetch job');
  return res.json();
}

export async function deleteJob(jobId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/jobs/${jobId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete job');
}

export async function saveMapping(jobId: string, mapping: ColumnMapping): Promise<ColumnMapping> {
  const res = await fetch(`${BASE_URL}/jobs/${jobId}/mapping`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(mapping),
  });
  if (!res.ok) throw new Error('Failed to save mapping');
  const data = await res.json();
  return data.mapping;
}

export async function getMapping(jobId: string): Promise<ColumnMapping> {
  const res = await fetch(`${BASE_URL}/jobs/${jobId}/mapping`);
  if (!res.ok) throw new Error('Failed to fetch mapping');
  return res.json();
}

export async function saveRules(
  jobId: string,
  weights: MatchingWeights,
  thresholds: MatchingThresholds
): Promise<any> {
  const res = await fetch(`${BASE_URL}/jobs/${jobId}/rules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ weights, thresholds }),
  });
  if (!res.ok) throw new Error('Failed to save matching rules');
  return res.json();
}

export async function getRules(jobId: string): Promise<{ weights: MatchingWeights; thresholds: MatchingThresholds }> {
  const res = await fetch(`${BASE_URL}/jobs/${jobId}/rules`);
  if (!res.ok) throw new Error('Failed to fetch rules');
  return res.json();
}

export async function startJob(jobId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/jobs/${jobId}/start`, { method: 'POST' });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to start job');
  }
}

export async function cancelJob(jobId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/jobs/${jobId}/cancel`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to cancel job');
}

export async function getProgress(jobId: string): Promise<JobProgressResponse> {
  const res = await fetch(`${BASE_URL}/jobs/${jobId}/progress`);
  if (!res.ok) throw new Error('Failed to fetch progress');
  return res.json();
}

export async function getSummary(jobId: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/jobs/${jobId}/summary`);
  if (!res.ok) throw new Error('Failed to fetch summary');
  return res.json();
}

export async function getResults(
  jobId: string,
  params: { filter?: string; search?: string; min_score?: number; page?: number; limit?: number }
): Promise<{
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  items: MatchedResultRow[];
}> {
  const url = new URL(`${window.location.origin}${BASE_URL}/jobs/${jobId}/results`);
  if (params.filter) url.searchParams.set('filter', params.filter);
  if (params.search) url.searchParams.set('search', params.search);
  if (params.min_score !== undefined) url.searchParams.set('min_score', String(params.min_score));
  if (params.page) url.searchParams.set('page', String(params.page));
  if (params.limit) url.searchParams.set('limit', String(params.limit));

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error('Failed to fetch results');
  return res.json();
}

export async function seedDemoDatasets(): Promise<{ file_a: UploadedFile; file_b: UploadedFile }> {
  const res = await fetch(`${BASE_URL}/demo/seed`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to seed demo data');
  return res.json();
}
