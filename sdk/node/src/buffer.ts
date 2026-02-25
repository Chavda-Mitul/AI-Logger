/**
 * LogBuffer - In-memory batch buffer for logs
 */

import { LogEntry } from './types';

interface BufferConfig {
  maxSize: number;
  flushIntervalMs: number;
  onFlush: (logs: LogEntry[]) => Promise<void>;
}

export class LogBuffer {
  private buffer: LogEntry[] = [];
  private config: BufferConfig;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(config: BufferConfig) {
    this.config = config;
    this.startTimer();
  }

  add(entry: LogEntry): void {
    this.buffer.push(entry);

    if (this.buffer.length >= this.config.maxSize) {
      const logs = this.drain();
      this.config.onFlush(logs).catch(() => {});
    }
  }

  drain(): LogEntry[] {
    const logs = [...this.buffer];
    this.buffer = [];
    return logs;
  }

  size(): number {
    return this.buffer.length;
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private startTimer(): void {
    this.timer = setInterval(() => {
      if (this.buffer.length > 0) {
        const logs = this.drain();
        this.config.onFlush(logs).catch(() => {});
      }
    }, this.config.flushIntervalMs);

    if (this.timer.unref) {
      this.timer.unref();
    }
  }
}
