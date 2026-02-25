"""
AILogger client — core implementation.
Uses only Python standard library (urllib, json).
Compatible with Python 3.7+.
"""

import json
import urllib.request
import urllib.error
from typing import Any, Dict, Optional

DEFAULT_BASE_URL = "https://api.ailogger.io"
DEFAULT_TIMEOUT  = 10  # seconds


class AILoggerError(Exception):
    """Raised when the AI Logger API returns an error."""

    def __init__(self, message: str, status_code: Optional[int] = None):
        super().__init__(message)
        self.status_code = status_code


class AILogger:
    """
    AI Logger client.

    Args:
        api_key:  Your AI Logger API key.
        base_url: Override the API base URL (useful for self-hosting).
        timeout:  HTTP request timeout in seconds (default 10).
        silent:   If True, suppress warnings on error (default False).
    """

    def __init__(
        self,
        api_key: str,
        base_url: str = DEFAULT_BASE_URL,
        timeout: int = DEFAULT_TIMEOUT,
        silent: bool = False,
    ) -> None:
        if not api_key or not isinstance(api_key, str):
            raise ValueError("[AILogger] api_key is required and must be a non-empty string.")

        self._api_key  = api_key
        self._base_url = base_url.rstrip("/")
        self._timeout  = timeout
        self._silent   = silent

    def log(
        self,
        *,
        prompt:     str,
        output:     str,
        model:      str,
        user_id:    Optional[str] = None,
        latency_ms: Optional[int] = None,
        metadata:   Optional[Dict[str, Any]] = None,
    ) -> Dict[str, str]:
        """
        Log an AI interaction.

        Args:
            prompt:     The prompt sent to the AI model.
            output:     The output returned by the AI model.
            model:      Model name (e.g. "gpt-4", "claude-3").
            user_id:    Optional hashed end-user identifier.
            latency_ms: Optional response latency in milliseconds.
            metadata:   Optional extra key-value pairs.

        Returns:
            dict with keys ``id`` and ``created_at``.

        Raises:
            AILoggerError: If the API returns an error response.
            ValueError:    If required parameters are missing.
        """
        if not prompt or not isinstance(prompt, str):
            raise ValueError("[AILogger] log() requires a non-empty string 'prompt'.")
        if not output or not isinstance(output, str):
            raise ValueError("[AILogger] log() requires a non-empty string 'output'.")
        if not model or not isinstance(model, str):
            raise ValueError("[AILogger] log() requires a non-empty string 'model'.")

        payload: Dict[str, Any] = {
            "prompt": prompt,
            "output": output,
            "model":  model,
        }
        if user_id    is not None: payload["userId"]    = user_id
        if latency_ms is not None: payload["latencyMs"] = latency_ms
        if metadata   is not None: payload["metadata"]  = metadata

        try:
            return self._request("POST", "/log", payload)
        except AILoggerError:
            raise
        except Exception as exc:
            if not self._silent:
                import warnings
                warnings.warn(f"[AILogger] Failed to log interaction: {exc}", stacklevel=2)
            raise AILoggerError(str(exc)) from exc

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _request(self, method: str, path: str, body: Dict[str, Any]) -> Dict[str, Any]:
        url  = self._base_url + path
        data = json.dumps(body).encode("utf-8")

        req = urllib.request.Request(
            url,
            data=data,
            method=method,
            headers={
                "Content-Type":  "application/json",
                "x-api-key":     self._api_key,
                "User-Agent":    "ai-logger-python-sdk/1.0.0",
            },
        )

        try:
            with urllib.request.urlopen(req, timeout=self._timeout) as resp:
                raw = resp.read().decode("utf-8")
                return json.loads(raw)
        except urllib.error.HTTPError as exc:
            raw = exc.read().decode("utf-8")
            try:
                detail = json.loads(raw).get("error", raw)
            except Exception:
                detail = raw
            raise AILoggerError(detail, status_code=exc.code) from exc
        except urllib.error.URLError as exc:
            raise AILoggerError(f"Network error: {exc.reason}") from exc
