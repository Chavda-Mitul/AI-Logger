"""
RegulateAI module-level singleton for easy access.
"""

from typing import Any, Callable, Optional, TypeVar

from .client import ComplianceLogger

# Module-level singleton instance
_instance: Optional[ComplianceLogger] = None

T = TypeVar('T')


def init(
    api_key: str,
    project_id: str,
    base_url: str = "https://api.regulateai.io",
    timeout: int = 10,
    silent: bool = False,
    buffer_size: int = 50,
    flush_interval: int = 5,
) -> ComplianceLogger:
    """
    Initialize the global RegulateAI logger instance.

    Args:
        api_key: Your RegulateAI API key (required).
        project_id: Your RegulateAI project ID (required).
        base_url: Override the API base URL (useful for self-hosting).
        timeout: HTTP request timeout in seconds (default 10).
        silent: If True, suppress warnings on error (default False).
        buffer_size: Number of logs to buffer before batch sending (default 50).
        flush_interval: Seconds between automatic flushes (default 5).

    Returns:
        The ComplianceLogger instance.

    Example:
        import regulateai

        regulateai.init(
            api_key="your-api-key",
            project_id="your-project-id"
        )
    """
    global _instance
    _instance = ComplianceLogger(
        api_key=api_key,
        project_id=project_id,
        base_url=base_url,
        timeout=timeout,
        silent=silent,
        buffer_size=buffer_size,
        flush_interval=flush_interval,
    )
    return _instance


def log(
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
    metadata: Optional[dict] = None,
) -> dict:
    """
    Log an AI interaction using the global instance.

    Must call init() first.

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

    Example:
        import regulateai

        regulateai.init("your-api-key", "project-id")
        regulateai.log(prompt="Hello", output="Hi", model="gpt-4")
    """
    if _instance is None:
        raise RuntimeError(
            "[RegulateAI] Not initialized. Call init(api_key, project_id) first."
        )
    return _instance.log(
        prompt=prompt,
        output=output,
        model=model,
        model_version=model_version,
        confidence=confidence,
        latency_ms=latency_ms,
        tokens_input=tokens_input,
        tokens_output=tokens_output,
        user_identifier=user_identifier,
        session_id=session_id,
        framework=framework,
        metadata=metadata,
    )


def wrap(
    model: str,
    model_version: Optional[str] = None,
    framework: Optional[str] = None,
) -> Callable[[Callable[..., T]], Callable[..., T]]:
    """
    Decorator to wrap AI function calls using the global instance.

    Must call init() first.

    Args:
        model: Model name (required).
        model_version: Optional model version string.
        framework: Optional framework name.

    Returns:
        A decorator function.

    Example:
        import regulateai

        regulateai.init("your-api-key", "project-id")

        @regulateai.wrap(model="gpt-4", framework="openai")
        def ask_ai(prompt):
            return openai.Completion.create(prompt=prompt).choices[0].text
    """
    if _instance is None:
        raise RuntimeError(
            "[RegulateAI] Not initialized. Call init(api_key, project_id) first."
        )
    return _instance.wrap(model=model, model_version=model_version, framework=framework)


def flush() -> None:
    """
    Flush all buffered logs using the global instance.

    Must call init() first.
    """
    if _instance is None:
        raise RuntimeError(
            "[RegulateAI] Not initialized. Call init(api_key, project_id) first."
        )
    _instance.flush()


def get_instance() -> Optional[ComplianceLogger]:
    """Get the current global instance, if initialized."""
    return _instance
