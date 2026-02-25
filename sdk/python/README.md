# AI Logger Python SDK

Zero-dependency Python SDK for [AI Logger](https://ailogger.io).

## Installation

```bash
pip install ai-logger-sdk
```

Or from source:
```bash
pip install ./sdk/python
```

## Usage

### Class-based (recommended)

```python
from ai_logger import AILogger

logger = AILogger("your-api-key")

result = logger.log(
    prompt="What is the capital of France?",
    output="Paris",
    model="gpt-4",
    user_id="hashed-user-123",   # optional
    latency_ms=342,               # optional
    metadata={"temperature": 0.7} # optional
)

print(result["id"])         # UUID of the log entry
print(result["created_at"]) # ISO timestamp
```

### Module-level singleton

```python
import ai_logger

ai_logger.init("your-api-key")

ai_logger.log(
    prompt="Summarize this document...",
    output="The document discusses...",
    model="claude-3-opus",
)
```

### Self-hosted backend

```python
logger = AILogger(
    "your-api-key",
    base_url="https://your-backend.example.com",
)
```

## Error Handling

```python
from ai_logger import AILogger
from ai_logger.client import AILoggerError

logger = AILogger("your-api-key")

try:
    logger.log(prompt="...", output="...", model="gpt-4")
except AILoggerError as e:
    print(f"API error {e.status_code}: {e}")
except Exception as e:
    print(f"Network error: {e}")
```

## Requirements

- Python 3.7+
- No external dependencies (uses `urllib` from the standard library)
