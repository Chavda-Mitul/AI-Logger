/**
 * RegulateAI SDK - TypeScript Type Definitions
 */

export interface LoggerConfig {
  apiKey: string;
  projectId?: string;
  endpoint?: string;
  batchSize?: number;
  flushIntervalMs?: number;
  maxRetries?: number;
  debug?: boolean;
}

export interface LogInput {
  prompt?: string | null;
  output?: string | null;
  model?: string | null;
  model_version?: string | null;
  confidence?: number | null;
  latency_ms?: number | null;
  tokens_input?: number | null;
  tokens_output?: number | null;
  human_reviewed?: boolean;
  human_reviewer_id?: string | null;
  human_review_notes?: string | null;
  framework?: string;
  status?: 'success' | 'error' | 'timeout';
  error_message?: string | null;
  session_id?: string | null;
  user_identifier?: string | null;
  metadata?: Record<string, unknown>;
}

export interface LogEntry extends LogInput {
  timestamp: string;
  sdk_version: string;
  sdk_language: 'node';
}

export interface IngestResponse {
  accepted: number;
  rejected: number;
  errors: Array<{ index: number; error: string }>;
  project_id: string;
}
