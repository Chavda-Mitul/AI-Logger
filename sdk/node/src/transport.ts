/**
 * HttpTransport - HTTP transport with retry logic
 */

import { LogEntry, IngestResponse } from './types';

interface TransportConfig {
  endpoint: string;
  apiKey: string;
  maxRetries: number;
}

export class HttpTransport {
  private config: TransportConfig;

  constructor(config: TransportConfig) {
    this.config = config;
  }

  async send(logs: LogEntry[]): Promise<IngestResponse> {
    const url = `${this.config.endpoint}/api/v1/ingest/logs`;
    
    const body = JSON.stringify({ logs });

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.config.apiKey,
          },
          body,
        });

        if (response.ok) {
          return await response.json() as IngestResponse;
        }

        if (response.status === 401) {
          throw new Error('Invalid API key. Check your configuration.');
        }

        if (response.status === 400) {
          const errorBody = await response.json().catch(() => ({}));
          throw new Error(errorBody.error || 'Bad request');
        }

        if (response.status === 429) {
          throw new Error('Rate limited. Slow down.');
        }

        // Server error - retry
        lastError = new Error(`HTTP ${response.status}`);
      } catch (error: unknown) {
        if (error instanceof Error) {
          // Don't retry auth errors
          if (error.message.includes('Invalid API key')) {
            throw error;
          }
          lastError = error;
        }
      }

      // Exponential backoff
      if (attempt < this.config.maxRetries) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }

    throw lastError || new Error('Failed to send logs');
  }
}
