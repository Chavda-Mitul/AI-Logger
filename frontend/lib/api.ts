/**
 * API client for the RegulateAI backend.
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('regulateai_token');
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  extraHeaders?: Record<string, string>
): Promise<T> {
  const token = getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extraHeaders,
  };

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('text/csv')) {
    return res.text() as unknown as T;
  }

  return res.json();
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name?: string;
    role: string;
    orgId: string;
  };
  organization?: {
    id: string;
    name: string;
  };
  project?: {
    id: string;
    name: string;
  };
  apiKey?: string; // Only returned on signup
}

export const authApi = {
  signup: (email: string, password: string, name?: string, company?: string) =>
    request<AuthResponse>('POST', '/auth/signup', { email, password, name, company }),

  login: (email: string, password: string) =>
    request<AuthResponse>('POST', '/auth/login', { email, password }),

  me: () =>
    request<{
      user: { id: string; email: string; name?: string; role: string };
      organization: { id: string; name: string };
      projects: Array<{
        id: string;
        name: string;
        risk_tier?: string;
        compliance_score?: number;
        status: string;
      }>;
    }>('GET', '/auth/me'),
};

// ── Projects ─────────────────────────────────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  description?: string;
  risk_tier?: string;
  compliance_score?: number;
  status: string;
  created_at: string;
  total_logs?: number;
}

export const projectsApi = {
  list: () => request<{ projects: Project[] }>('GET', '/api/v1/projects'),

  get: (id: string) => request<{ project: Project }>('GET', `/api/v1/projects/${id}`),

  create: (name: string, description?: string) =>
    request<{ project: Project }>('POST', '/api/v1/projects', { name, description }),

  update: (id: string, name: string, description?: string) =>
    request<{ project: Project }>('PUT', `/api/v1/projects/${id}`, { name, description }),

  delete: (id: string) => request<{ success: boolean }>('DELETE', `/api/v1/projects/${id}`),

  listApiKeys: (projectId: string) =>
    request<{ api_keys: Array<{ id: string; key_prefix: string; name: string; is_active: boolean; created_at: string }> }>(
      'GET',
      `/api/v1/projects/${projectId}/api-keys`
    ),

  createApiKey: (projectId: string, name?: string) =>
    request<{ api_key: { id: string }; raw_key: string }>('POST', `/api/v1/projects/${projectId}/api-keys`, { name }),

  revokeApiKey: (keyId: string) =>
    request<{ success: boolean }>('DELETE', `/api/v1/projects/api-keys/${keyId}`),
};

// ── Dashboard Stats ─────────────────────────────────────────────────────────

export interface DashboardStats {
  project: { id: string; name: string; risk_tier?: string; compliance_score: number };
  total_logs: number;
  logs_today: number;
  logs_this_week: number;
  avg_latency_ms: number | null;
  avg_confidence: number | null;
  error_rate: number;
  human_review_rate: number;
  human_reviewed_count: number;
  model_changes_this_month: number;
  models_in_use: string[];
  documents_created: number;
  documents_required: number;
  documents_finalized: number;
  unread_alerts: number;
}

export interface DailyCount {
  date: string;
  total_logs: number;
  human_reviewed_count: number;
  error_count: number;
  avg_latency: number;
}

export interface ModelDistribution {
  model: string;
  model_version: string;
  usage_count: number;
  avg_latency: number;
  avg_confidence: number;
}

export const dashboardApi = {
  stats: (projectId: string) =>
    request<DashboardStats>('GET', `/api/v1/dashboard/stats?project_id=${projectId}`),

  dailyCounts: (projectId: string, days = 30) =>
    request<{ daily_counts: DailyCount[] }>(
      'GET',
      `/api/v1/dashboard/daily-counts?project_id=${projectId}&days=${days}`
    ),

  modelDistribution: (projectId: string) =>
    request<{ models: ModelDistribution[] }>(
      'GET',
      `/api/v1/dashboard/model-distribution?project_id=${projectId}`
    ),
};

// ── Logs ───────────────────────────────────────────────────────────────────

export interface Log {
  id: string;
  prompt: string;
  output: string;
  model: string;
  model_version: string;
  confidence: number | null;
  latency_ms: number | null;
  tokens_input: number | null;
  tokens_output: number | null;
  human_reviewed: boolean;
  framework: string;
  status: string;
  session_id: string | null;
  user_identifier: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface LogsResponse {
  logs: Log[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const logsApi = {
  list: (
    projectId: string,
    filters: {
      page?: number;
      limit?: number;
      model?: string;
      status?: string;
      human_reviewed?: boolean;
      search?: string;
      from?: string;
      to?: string;
    } = {}
  ) => {
    const params = new URLSearchParams({ project_id: projectId, ...filters } as Record<string, string>);
    return request<LogsResponse>('GET', `/api/v1/logs?${params}`);
  },

  get: (id: string) => request<{ log: Log }>('GET', `/api/v1/logs/${id}`),

  export: (
    projectId: string,
    filters: { model?: string; status?: string; human_reviewed?: boolean; from?: string; to?: string } = {}
  ) => {
    const params = new URLSearchParams({ project_id: projectId, ...filters } as Record<string, string>);
    return request<string>('GET', `/api/v1/logs/export?${params}`);
  },
};

// ── Alerts ──────────────────────────────────────────────────────────────────

export interface Alert {
  id: string;
  type: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  is_read: boolean;
  is_resolved: boolean;
  created_at: string;
}

export const alertsApi = {
  list: (projectId?: string, unreadOnly = false) => {
    const params = new URLSearchParams();
    if (projectId) params.set('project_id', projectId);
    if (unreadOnly) params.set('unread_only', 'true');
    return request<{ alerts: Alert[]; pagination: { page: number; limit: number; total: number } }>(
      'GET',
      `/api/v1/alerts?${params}`
    );
  },

  markRead: (id: string) =>
    request<{ success: boolean }>('PUT', `/api/v1/alerts/${id}/read`),

  resolve: (id: string) =>
    request<{ success: boolean }>('PUT', `/api/v1/alerts/${id}/resolve`),
};

// ── Assessments ───────────────────────────────────────────────────────────

export interface Assessment {
  id: string;
  project_id: string | null;
  email: string | null;
  company_name: string | null;
  answers: Record<string, any>;
  risk_tier: 'PROHIBITED' | 'HIGH' | 'LIMITED' | 'MINIMAL';
  compliance_score: number;
  matched_articles: string[];
  obligations: Record<string, any>;
  documents_required: string[];
  dpdp_applicable: boolean;
  dpdp_obligations: Record<string, any> | null;
  estimated_effort: string | null;
  urgency: 'immediate' | '3_months' | '6_months' | null;
  created_at: string;
}

export const assessmentsApi = {
  create: (data: {
    project_id?: string;
    email?: string;
    company_name?: string;
    answers: Record<string, any>;
    risk_tier: string;
    compliance_score: number;
    matched_articles?: string[];
    obligations: Record<string, any>;
    documents_required?: string[];
    dpdp_applicable?: boolean;
    dpdp_obligations?: Record<string, any>;
    estimated_effort?: string;
    urgency?: string;
  }) =>
    request<{ id: string; risk_tier: string; compliance_score: number }>(
      'POST',
      '/api/v1/assessments',
      data
    ),

  get: (id: string) =>
    request<{ assessment: Assessment }>('GET', `/api/v1/assessments/${id}`),

  getByProject: (projectId: string) =>
    request<{ assessment: Assessment }>('GET', `/api/v1/assessments/project/${projectId}`),
};

// ── Documents ─────────────────────────────────────────────────────────────

export interface ComplianceDocument {
  id: string;
  project_id: string;
  document_type: string;
  title: string;
  version: number;
  content: Record<string, any>;
  status: 'draft' | 'review' | 'final';
  created_at: string;
  updated_at: string;
}

export const documentsApi = {
  listByProject: (projectId: string) =>
    request<{ documents: ComplianceDocument[] }>(
      'GET',
      `/api/v1/projects/${projectId}/documents`
    ),

  create: (projectId: string, data: {
    document_type: string;
    title: string;
    content: Record<string, any>;
    form_data?: Record<string, any>;
    status?: string;
  }) =>
    request<{ document: ComplianceDocument }>(
      'POST',
      `/api/v1/projects/${projectId}/documents`,
      data
    ),

  get: (id: string) =>
    request<{ document: ComplianceDocument }>('GET', `/api/v1/documents/${id}`),

  update: (id: string, data: {
    title?: string;
    content?: Record<string, any>;
    status?: string;
    change_summary?: string;
  }) =>
    request<{ success: boolean; version: number }>(
      'PUT',
      `/api/v1/documents/${id}`,
      data
    ),

  getVersions: (id: string) =>
    request<{
      versions: Array<{
        id: string;
        version: number;
        change_summary: string;
        created_at: string;
        changed_by_name: string | null;
      }>;
    }>('GET', `/api/v1/documents/${id}/versions`),
};
