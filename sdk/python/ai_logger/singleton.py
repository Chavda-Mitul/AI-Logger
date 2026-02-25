"""
Module-level singleton for convenience usage:

    import ai_logger
    ai_logger.init("YOUR_API_KEY")
    ai_logger.log(prompt="...", output="...", model="gpt-4")
"""

from typing import Any, Dict, Optional
from .client import AILogger

_instance: Optional[AILogger] = None


def init(api_key: str, **kwargs: Any) -> AILogger:
    """
    Initialize the default singleton instance.

    Args:
        api_key: Your AI Logger API key.
        **kwargs: Passed directly to AILogger (base_url, timeout, silent).

    Returns:
        The AILogger instance.
    """
    global _instance
    _instance = AILogger(api_key, **kwargs)
    return _instance


def log(
    *,
    prompt:     str,
    output:     str,
    model:      str,
    user_id:    Optional[str] = None,
    latency_ms: Optional[int] = None,
    metadata:   Optional[Dict[str, Any]] = None,
) -> Dict[str, str]:
    """
    Log using the default singleton instance.
    Must call ``ai_logger.init()`` first.
    """
    if _instance is None:
        raise RuntimeError(
            "[AILogger] Call ai_logger.init('YOUR_API_KEY') before ai_logger.log()."
        )
    return _instance.log(
        prompt=prompt,
        output=output,
        model=model,
        user_id=user_id,
        latency_ms=latency_ms,
        metadata=metadata,
    )
