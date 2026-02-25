"""
RegulateAI — Python SDK

EU AI Act Compliance Logging Platform

Usage:
    from regulateai import ComplianceLogger

    logger = ComplianceLogger("your-api-key", project_id="project-id")
    logger.log(
        prompt="What is the capital of France?",
        output="Paris",
        model="gpt-4",
    )

Or using the module-level singleton:
    import regulateai

    regulateai.init("your-api-key", project_id="project-id")
    regulateai.log(prompt="...", output="...", model="gpt-4")

Or wrap an existing function:
    @regulateai.wrap(model="gpt-4")
    def ask_ai(prompt):
        return openai.Completion.create(prompt=prompt)
"""

from .client import ComplianceLogger
from .singleton import init, log, wrap, flush

__all__ = ["ComplianceLogger", "init", "log", "wrap", "flush"]
__version__ = "2.0.0"
