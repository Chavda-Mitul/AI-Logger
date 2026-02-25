/**
 * RegulateAI SDK - Entry Point
 * 
 * EU AI Act Compliance Logging Platform
 */

export { ComplianceLogger } from './logger';
export { LogBuffer } from './buffer';
export { HttpTransport } from './transport';
export * from './types';

// Default instance for convenience
import { ComplianceLogger } from './logger';
import type { LoggerConfig, LogInput } from './types';

let _instance: ComplianceLogger | null = null;

export function init(config: LoggerConfig): ComplianceLogger {
  _instance = new ComplianceLogger(config);
  return _instance;
}

export function log(input: LogInput): void {
  if (!_instance) {
    throw new Error('[RegulateAI] Call init() before log()');
  }
  _instance.log(input);
}

export async function wrap<T>(
  promise: Promise<T>,
  options?: { humanReviewed?: boolean; metadata?: Record<string, unknown> }
): Promise<T> {
  if (!_instance) {
    throw new Error('[RegulateAI] Call init() before wrap()');
  }
  return _instance.wrap(promise, options);
}

export async function shutdown(): Promise<void> {
  if (_instance) {
    await _instance.shutdown();
  }
}
