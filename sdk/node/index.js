/**
 * AI Logger — Node.js SDK
 *
 * Zero-dependency SDK that uses the built-in `https` module.
 *
 * Usage:
 *   const { AILogger } = require('ai-logger-sdk');
 *   const logger = new AILogger('your-api-key');
 *
 *   await logger.log({
 *     prompt:  'What is the capital of France?',
 *     output:  'Paris',
 *     model:   'gpt-4',
 *     userId:  'hashed-user-123',   // optional
 *   });
 */

'use strict';

const https = require('https');
const http  = require('http');
const { URL } = require('url');

const DEFAULT_BASE_URL = 'https://api.ailogger.io';
const DEFAULT_TIMEOUT  = 10_000; // 10 seconds

class AILogger {
  /**
   * @param {string} apiKey       - Your AI Logger API key
   * @param {object} [options]
   * @param {string} [options.baseUrl]  - Override API base URL (useful for self-hosting)
   * @param {number} [options.timeout]  - Request timeout in ms (default 10000)
   * @param {boolean} [options.silent]  - Suppress console warnings on error (default false)
   */
  constructor(apiKey, options = {}) {
    if (!apiKey || typeof apiKey !== 'string') {
      throw new Error('[AILogger] apiKey is required and must be a string.');
    }

    this._apiKey  = apiKey;
    this._baseUrl = (options.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '');
    this._timeout = options.timeout ?? DEFAULT_TIMEOUT;
    this._silent  = options.silent  ?? false;
  }

  /**
   * Log an AI interaction.
   *
   * @param {object} params
   * @param {string} params.prompt      - The prompt sent to the AI model
   * @param {string} params.output      - The output returned by the AI model
   * @param {string} params.model       - Model name (e.g. "gpt-4", "claude-3")
   * @param {string} [params.userId]    - Optional hashed end-user identifier
   * @param {number} [params.latencyMs] - Optional response latency in milliseconds
   * @param {object} [params.metadata]  - Optional extra key-value pairs
   *
   * @returns {Promise<{ id: string, created_at: string }>}
   */
  async log({ prompt, output, model, userId, latencyMs, metadata } = {}) {
    if (!prompt || typeof prompt !== 'string') {
      throw new Error('[AILogger] log() requires a non-empty string "prompt".');
    }
    if (!output || typeof output !== 'string') {
      throw new Error('[AILogger] log() requires a non-empty string "output".');
    }
    if (!model || typeof model !== 'string') {
      throw new Error('[AILogger] log() requires a non-empty string "model".');
    }

    const body = JSON.stringify({
      prompt,
      output,
      model,
      ...(userId    !== undefined && { userId }),
      ...(latencyMs !== undefined && { latencyMs }),
      ...(metadata  !== undefined && { metadata }),
    });

    try {
      const result = await this._request('POST', '/log', body);
      return result;
    } catch (err) {
      if (!this._silent) {
        console.warn('[AILogger] Failed to log interaction:', err.message);
      }
      throw err;
    }
  }

  /**
   * Internal HTTP request helper (no external dependencies).
   * @private
   */
  _request(method, path, body) {
    return new Promise((resolve, reject) => {
      const url      = new URL(this._baseUrl + path);
      const isHttps  = url.protocol === 'https:';
      const transport = isHttps ? https : http;

      const options = {
        hostname: url.hostname,
        port:     url.port || (isHttps ? 443 : 80),
        path:     url.pathname + url.search,
        method,
        headers: {
          'Content-Type':  'application/json',
          'Content-Length': Buffer.byteLength(body),
          'x-api-key':     this._apiKey,
          'User-Agent':    'ai-logger-node-sdk/1.0.0',
        },
      };

      const req = transport.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed);
            } else {
              reject(new Error(parsed.error || `HTTP ${res.statusCode}`));
            }
          } catch {
            reject(new Error(`Failed to parse response: ${data}`));
          }
        });
      });

      req.setTimeout(this._timeout, () => {
        req.destroy();
        reject(new Error('[AILogger] Request timed out.'));
      });

      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }
}

// ── Convenience factory (matches the aiLogger.init() style) ──────────────────

let _defaultInstance = null;

const aiLogger = {
  /**
   * Initialize the default singleton instance.
   * @param {string} apiKey
   * @param {object} [options]
   */
  init(apiKey, options = {}) {
    _defaultInstance = new AILogger(apiKey, options);
    return _defaultInstance;
  },

  /**
   * Log using the default singleton instance.
   * Must call aiLogger.init() first.
   */
  async log(params) {
    if (!_defaultInstance) {
      throw new Error('[AILogger] Call aiLogger.init("YOUR_API_KEY") before aiLogger.log().');
    }
    return _defaultInstance.log(params);
  },
};

module.exports = { AILogger, aiLogger };
