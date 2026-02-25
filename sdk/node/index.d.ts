/**
 * AI Logger Node.js SDK — TypeScript type definitions
 */

export interface LogParams {
  prompt:     string;
  output:     string;
  model:      string;
  userId?:    string;
  latencyMs?: number;
  metadata?:  Record<string, unknown>;
}

export interface LogResult {
  id:         string;
  created_at: string;
}

export interface AILoggerOptions {
  baseUrl?: string;
  timeout?: number;
  silent?:  boolean;
}

export class AILogger {
  constructor(apiKey: string, options?: AILoggerOptions);
  log(params: LogParams): Promise<LogResult>;
}

export declare const aiLogger: {
  init(apiKey: string, options?: AILoggerOptions): AILogger;
  log(params: LogParams): Promise<LogResult>;
};
