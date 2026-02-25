# AI Logger Node.js SDK

Zero-dependency Node.js SDK for [AI Logger](https://ailogger.io).

## Installation

```bash
npm install ai-logger-sdk
```

## Usage

### Class-based (recommended)

```js
const { AILogger } = require('ai-logger-sdk');

const logger = new AILogger('your-api-key');

const result = await logger.log({
  prompt:    'What is the capital of France?',
  output:    'Paris',
  model:     'gpt-4',
  userId:    'hashed-user-123',   // optional
  latencyMs: 342,                  // optional
  metadata:  { temperature: 0.7 }, // optional
});

console.log(result.id);         // UUID of the log entry
console.log(result.created_at); // ISO timestamp
```

### Module-level singleton

```js
const { aiLogger } = require('ai-logger-sdk');

aiLogger.init('your-api-key');

await aiLogger.log({
  prompt: 'Summarize this document...',
  output: 'The document discusses...',
  model:  'claude-3-opus',
});
```

### TypeScript

```ts
import { AILogger, type LogParams } from 'ai-logger-sdk';

const logger = new AILogger('your-api-key');

const params: LogParams = {
  prompt: '...',
  output: '...',
  model:  'gpt-4',
};

await logger.log(params);
```

### Self-hosted backend

```js
const logger = new AILogger('your-api-key', {
  baseUrl: 'https://your-backend.example.com',
});
```

## Error Handling

```js
try {
  await logger.log({ prompt, output, model });
} catch (err) {
  console.error('Logging failed:', err.message);
  // Errors are non-fatal — your app continues running
}
```

## Options

| Option    | Type    | Default                      | Description                        |
|-----------|---------|------------------------------|------------------------------------|
| `baseUrl` | string  | `https://api.ailogger.io`    | Override API base URL              |
| `timeout` | number  | `10000`                      | Request timeout in milliseconds    |
| `silent`  | boolean | `false`                      | Suppress console warnings on error |

## Requirements

- Node.js 16+
- No external dependencies (uses built-in `https` module)
