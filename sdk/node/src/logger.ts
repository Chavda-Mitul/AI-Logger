/**
 * ComplianceLogger - Main SDK class
 * 
 * EU AI Act compliance logging for AI systems.
 */

import { LogBuffer } from './buffer';
import { HttpTransport } from './transport';
import { LoggerConfig, LogInput, LogEntry, IngestResponse } from './types';

const SDK_VERSION = '1.0.0';

export class ComplianceLogger {
  private buffer: LogBuffer;
  private transport: HttpTransport;
  private config: LoggerConfig;
  private lastModel: string | null = null;
  private lastModelVersion: string | null = null;

  constructor(config: LoggerConfig) {
    if (!config.apiKey) {
      throw new Error('[RegulateAI] apiKey is required');
    }

    this.config = {
      apiKey: config.apiKey,
      projectId: config.projectId,
      endpoint: config.endpoint || 'https://api.regulateai.com',
      batchSize: config.batchSize || 50,
      flushIntervalMs: config.flushIntervalMs || 5000,
      maxRetries: config.maxRetries || 3,
      debug: config.debug || false,
    };

    this.transport = new HttpTransport({
      endpoint: this.config.endpoint!,
      apiKey: this.config.apiKey,
      maxRetries: this.config.maxRetries!,
    });

    this.buffer = new LogBuffer({
      maxSize: this.config.batchSize!,
      flushIntervalMs: this.config.flushIntervalMs!,
      onFlush: (logs) => this.flush(logs),
    });

    if (this.config.debug) {
      console.log('[RegulateAI] Initialized with endpoint:', this.config.endpoint);
    }
  }

  /**
   * Manually log an AI decision
   */
  log(input: LogInput): void {
    const entry: LogEntry = {
      ...input,
      timestamp: new Date().toISOString(),
      sdk_version: SDK_VERSION,
      sdk_language: 'node',
    };

    // Track model changes
    if (input.model && input.model_version) {
      if (this.lastModel && this.lastModelVersion) {
        if (input.model !== this.lastModel || input.model_version !== this.lastModelVersion) {
          entry.metadata = {
            ...entry.metadata,
            _model_changed: true,
            _previous_model: this.lastModel,
            _previous_version: this.lastModelVersion,
          };
        }
      }
      this.lastModel = input.model;
      this.lastModelVersion = input.model_version;
    }

    this.buffer.add(entry);
  }

  /**
   * Wrap an AI API call to auto-capture everything
   * 
   * Usage:
   *   const result = await logger.wrap(openai.chat.completions.create({...}))
   */
  async wrap<T>(
    promise: Promise<T>,
    options?: { humanReviewed?: boolean; metadata?: Record<string, unknown> }
  ): Promise<T> {
    const startTime = Date.now();
    let status: 'success' | 'error' = 'success';
    let errorMessage: string | null = null;
    let result: T | undefined;

    try {
      result = await promise;
    } catch (error: unknown) {
      status = 'error';
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw error;
    } finally {
      const latencyMs = Date.now() - startTime;

      try {
        const data = (result as Record<string, unknown>) || {};
        
        this.log({
          prompt: this.extractPrompt(data),
          output: this.extractOutput(data),
          model: this.extractModel(data),
          model_version: this.extractModelVersion(data),
          confidence: this.extractConfidence(data),
          latency_ms: latencyMs,
          tokens_input: (data?.usage as Record<string, number>)?.prompt_tokens || undefined,
          tokens_output: (data?.usage as Record<string, number>)?.completion_tokens || undefined,
          human_reviewed: options?.humanReviewed || false,
          framework: this.detectFramework(data),
          status,
          error_message: errorMessage,
          metadata: options?.metadata,
        });
      } catch {
        // Never crash the host app
        this.log({
          prompt: null,
          output: null,
          model: null,
          latency_ms: latencyMs,
          status,
          error_message: errorMessage,
          metadata: { _extraction_failed: true, ...options?.metadata },
        });
      }
    }

    return result as T;
  }

  /**
   * Flush all buffered logs immediately
   */
  async flush(logs?: LogEntry[]): Promise<void> {
    const toFlush = logs || this.buffer.drain();
    if (toFlush.length === 0) return;

    try {
      const response = await this.transport.send(toFlush);
      if (this.config.debug) {
        console.log(`[RegulateAI] Flushed ${toFlush.length} logs:`, response);
      }
    } catch (error) {
      if (!this.config.debug) {
        console.warn('[RegulateAI] Failed to flush logs:', error);
      }
    }
  }

  /**
   * Graceful shutdown - flush remaining logs
   */
  async shutdown(): Promise<void> {
    this.buffer.stop();
    await this.flush();
  }

  // Private helpers to extract data from AI API responses

  private extractPrompt(data: Record<string, unknown>): string | null {
    const messages = (data?.messages as Array<Record<string, unknown>>) || [];
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      const content = lastMsg?.content;
      return typeof content === 'string' ? content : JSON.stringify(content);
    }
    return null;
  }

  private extractOutput(data: Record<string, unknown>): string | null {
    const choices = (data?.choices as Array<Record<string, unknown>>) || [];
    if (choices[0]) {
      const msg = choices[0].message as Record<string, unknown>;
      return msg?.content as string | null;
    }
    return null;
  }

  private extractModel(data: Record<string, unknown>): string | null {
    return (data?.model as string) || null;
  }

  private extractModelVersion(data: Record<string, unknown>): string | null {
    return (data?.model as string) || null;
  }

  private extractConfidence(_data: Record<string, unknown>): number | null {
    // Could implement logprobs-based confidence calculation
    return null;
  }

  private detectFramework(data: Record<string, unknown>): string {
    if (data?.object === 'chat.completion') return 'openai';
    if (data?.object === 'text_completion') return 'openai';
    return 'custom';
  }
}
