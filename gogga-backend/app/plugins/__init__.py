"""
GOGGA Plugin System
Plugins enhance the chat pipeline with passive analysis and context enrichment.
"""

from .base import Plugin
from .language_detector import LanguageDetectorPlugin

__all__ = ["Plugin", "LanguageDetectorPlugin"]
