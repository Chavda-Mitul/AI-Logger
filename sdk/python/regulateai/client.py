"""
RegulateAI client — core implementation.
EU AI Act Compliance Logging Platform.

Uses only Python standard library (urllib, json, threading).
Compatible with Python 3.8+.
"""

import json
import urllib.request
import urllib.error
import threading
import time
from typing import Any, Callable, Dict, Optional, TypeVar
from datetime import datetime

DEFAULT_BASE_URL = "https://api.regulateai.io"
DEFAULT_TIMEOUT = 10  # seconds
DEFAULT_BUFFER_SIZE = 50
DEFAULT_FLUSH_INTERVAL = 5  # seconds

T = TypeVar('T')


class RegulateAIError(Exception):
    """Raised when the RegulateAI API returns an error."""

    def __init__(self, message: str, status_code: Optional[int] = None):
        super().__init__(message)
        self.status_code = status_code


class LogBuffer:
    """In-memory buffer for batching logs before sending to API."""

    def __init__(self, buffer_size: int = DEFAULT_BUFFER_SIZE):
        self._buffer: list[Dict[str, Any]] = []
        self._buffer_size = buffer_size
        self._lock = threading.Lock()

    def add(self, log_entry: Dict[str, Any]) -> bool:
        """Add a log entry. Returns True if buffer is full and should be flushed."""
        with self._lock:
            self._buffer.append(log_entry)
            return len(self._buffer) >= self._buffer_size

    def flush(self) -> list[Dict[str, Any]]:
        """Clear and return all buffered entries."""
        with self._lock:
            entries = self._buffer.copy()
            self._buffer.clear()
            return entries

    def size(self) -> int:
        """Current buffer size."""
        with self._lock:
            return len(self._buffer)

    def is_empty(self) -> bool:
        return self.size() == 0


class ComplianceLogger:
    """
    RegulateAI compliance logger for EU AI Act tracking.

    Args:
        api_key: Your RegulateAI API key (required).
        project_id: Your RegulateAI project ID (required).
        base_url: Override the API base URL (useful for self-hosting).
        timeout: HTTP request timeout in seconds (default 10).
        silent: If True, suppress warnings on error (default False).
        buffer_size: Number of logs to buffer before batch sending (default 50).
        flush_interval: Seconds between automatic flushes (default 5).
    """

    def __init__(
        self,
        api_key: str,
        project_id: str,
        base_url: str = DEFAULT_BASE_URL,
        timeout: int = DEFAULT_TIMEOUT,
        silent: bool = False,
        buffer_size: int = DEFAULT_BUFFER_SIZE,
        flush_interval: int = DEFAULT_FLUSH_INTERVAL,
    ) -> None:
        if not api_key or not isinstance(api_key, str):
            raise ValueError("[RegulateAI] api_key is required and must be a non-empty string.")
        if not project_id or not isinstance(project_id, str):
            raise ValueError("[RegulateAI] project_id is required and must be a non-empty string.")

        self._api_key = api_key
        self._project_id = project_id
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout
        self._silent = silent
        self._buffer = LogBuffer(buffer_size)
        self._flush_interval = flush_interval
        self._last_flush = time.time()
        self._flush_thread: Optional[threading.Thread] = None
        self._running = True

        # Start background flush thread
        if flush_interval > 0:
            self._flush_thread = threading.Thread(target=self._background_flush, daemon=True)
            self._flush_thread.start()

    def _background_flush(self) -> None:
        """Background thread to periodically flush the buffer."""
        while self._running:
            time.sleep(1)
            if time.time() - self._last_flush >= self._flush_interval:
                if not self._buffer.is_empty():
                    self._flush()

    def _should_flush(self) -> bool:
        """Check if we should flush based on buffer size or time."""
        return self._buffer.size() >= self._buffer._buffer_size or \
               (time.time() - self._last_flush) >= self._flush_interval

    def _flush(self) -> None:
        """Flush the buffer to the API."""
        entries = self._buffer.flush()
        if not entries:
            return

        try:
            self._request("POST", "/ingest/logs", {"logs": entries})
        except RegulateAIError as e:
            if not self._silent:
                import warnings
                warnings.warn(f"[RegulateAI] Failed to flush {len(entries)} logs: {e}", stacklevel=2)

        self._last_flush = time.time()

    def log(
        self,
        *,
        prompt: str,
        output: str,
        model: str,
        model_version: Optional[str] = None,
        confidence: Optional[float] = None,
        latency_ms: Optional[int] = None,
        tokens_input: Optional[int] = None,
        tokens_output: Optional[int] = None,
        user_identifier: Optional[str] = None,
        session_id: Optional[str] = None,
        framework: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Log an AI interaction for EU AI Act compliance.

        Args:
            prompt: The prompt sent to the AI model (required).
            output: The output returned by the AI model (required).
            model: Model name (e.g. "gpt-4", "claude-3") (required).
            model_version: Optional model version string.
            confidence: Optional confidence score (0-1).
            latency_ms: Optional response latency in milliseconds.
            tokens_input: Optional number of input tokens.
            tokens_output: Optional number of output tokens.
            user_identifier: Optional hashed end-user identifier.
            session_id: Optional session identifier.
            framework: Optional framework (e.g., "openai", "anthropic", "custom").
            metadata: Optional extra key-value pairs.

        Returns:
            dict with keys ``id`` and ``created_at``.

        Raises:
            RegulateAIError: If the API returns an error response.
            ValueError: If required parameters are missing.
        """
        if not prompt or not isinstance(prompt, str):
            raise ValueError("[RegulateAI] log() requires a non-empty string 'prompt'.")
        if not output or not isinstance(output, str):
            raise ValueError("[RegulateAI] log() requires a non-empty string 'output'.")
        if not model or not isinstance(model, str):
            raise ValueError("[RegulateAI] log() requires a non-empty string 'model'.")

        payload: Dict[str, Any] = {
            "prompt": prompt,
            "output": output,
            "model": model,
        }

        if model_version is not None:
            payload["modelVersion"] = model_version
        if confidence is not None:
            payload["confidence"] = confidence
        if latency_ms is not None:
            payload["latencyMs"] = latency_ms
        if tokens_input is not None:
            payload["tokensInput"] = tokens_input
        if tokens_output is not None:
            payload["tokensOutput"] = tokens_output
        if user_identifier is not None:
            payload["userIdentifier"] = user_identifier
        if session_id is not None:
            payload["sessionId"] = session_id
        if framework is not None:
            payload["framework"] = framework
        if metadata is not None:
            payload["metadata"] = metadata

        # Add to buffer
        self._buffer.add(payload)

        # Check if we should flush
        if self._should_flush():
            self._flush()

        return {
            "id": f"local-{int(time.time() * 1000)}",
            "created_at": datetime.utcnow().isoformat() + "Z",
            "buffered": True,
        }

    def wrap(
        self,
        model: str,
        model_version: Optional[str] = None,
        framework: Optional[str] = None,
    ) -> Callable[[Callable[..., T]], Callable[..., T]]:
        """
        Decorator to wrap AI function calls and automatically log them.

        Args:
            model: Model name (required).
            model_version: Optional model version string.
            framework: Optional framework name.

        Usage:
            @logger.wrap(model="gpt-4", framework="openai")
            def ask_ai(prompt: str) -> str:
                return openai.Completion.create(prompt=prompt).choices[0].text
        """
        def decorator(func: Callable[..., T]) -> Callable[..., T]:
            def wrapper(*args: Any, **kwargs: Any) -> T:
                start_time = time.time()

                # Extract prompt from args/kwargs if possible
                prompt = None
                if args:
                    prompt = args[0] if isinstance(args[0], str) else str(args[0])
                elif "prompt" in kwargs:
                    prompt = kwargs["prompt"]

                # Execute the function
                result = func(*args, **kwargs)

                # Extract output
                output = None
                if hasattr(result, "choices") and result.choices:
                    # OpenAI response format
                    output = result.choices[0].text or result.choices[0].message.content
                elif hasattr(result, "content"):
                    # Anthropic or similar format
                    output = result.content
                elif isinstance(result, str):
                    output = result
                else:
                    output = str(result)

                # Calculate latency
                latency_ms = int((time.time() - start_time) * 1000)

                # Extract token counts if available
                tokens_input = None
                tokens_output = None
                if hasattr(result, "usage"):
                    tokens_input = result.usage.prompt_tokens
                    tokens_output = result.usage.completion_tokens

                # Extract model if not provided
                actual_model = model
                if hasattr(result, "model") and not model_version:
                    actual_model = result.model

                # Log the interaction
                self.log(
                    prompt=prompt or "",
                    output=output or "",
                    model=actual_model,
                    model_version=model_version,
                    latency_ms=latency_ms,
                    tokens_input=tokens_input,
                    tokens_output=tokens_output,
                    framework=framework,
                )

                return result

            return wrapper
        return decorator

    def flush(self) -> None:
        """Manually flush all buffered logs."""
        self._flush()

    def close(self) -> None:
        """Stop background thread and flush remaining logs."""
        self._running = False
        self.flush()

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _request(self, method: str, path: str, body: Dict[str, Any]) -> Dict[str, Any]:
        url = f"{self._base_url}{path}"
        data = json.dumps(body).encode("utf-8")

        req = urllib.request.Request(
            url,
            data=data,
            method=method,
            headers={
                "Content-Type": "application/json",
                "x-api-key": self._api_key,
                "x-project-id": self._project_id,
                "User-Agent": "regulateai-python-sdk/2.0.0",
            },
        )

        try:
            with urllib.request.urlopen(req, timeout=self._timeout) as resp:
                raw = resp.read().decode("utf-8")
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as exc:
            raw = exc.read().decode("utf-8")
            try:
                detail = json.loads(raw).get("error", raw)
            except Exception:
                detail = raw
            raise RegulateAIError(detail, status_code=exc.code) from exc
        except urllib.error.URLError as exc:
            raise RegulateAIError(f"Network error: {exc.reason}") from exc
