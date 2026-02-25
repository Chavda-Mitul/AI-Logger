"""
AI Logger — Python SDK

Zero-dependency SDK (uses only the standard library urllib).

Usage:
    from ai_logger import AILogger

    logger = AILogger("your-api-key")
    logger.log(
        prompt="What is the capital of France?",
        output="Paris",
        model="gpt-4",
        user_id="hashed-user-123",
    )

Or using the module-level singleton:
    import ai_logger

    ai_logger.init("your-api-key")
    ai_logger.log(prompt="...", output="...", model="gpt-4")
"""

from .client import AILogger
from .singleton import init, log

__all__ = ["AILogger", "init", "log"]
__version__ = "1.0.0"
