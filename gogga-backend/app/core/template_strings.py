"""
GOGGA Template String Utilities - Python 3.14

Leverages PEP 750 t-strings for safe string construction:
- SQL injection prevention
- XSS/HTML escaping  
- Structured logging
- Shell command sanitization

Python 3.14 Features:
- string.templatelib.Template for t-string processing
- string.templatelib.Interpolation for value extraction
"""
from __future__ import annotations

import html
import json
import logging
import re
import shlex
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Callable

# Python 3.14: Template string support
try:
    from string.templatelib import Template, Interpolation
    TSTRINGS_AVAILABLE = True
except ImportError:
    # Fallback for Python < 3.14
    TSTRINGS_AVAILABLE = False
    Template = str
    Interpolation = None


logger = logging.getLogger(__name__)


# ============================================================================
# SQL Sanitization
# ============================================================================

class SQLDialect(str, Enum):
    """Supported SQL dialects for escaping."""
    SQLITE = "sqlite"
    POSTGRES = "postgres"
    MYSQL = "mysql"


def _escape_sql_value(value: Any, dialect: SQLDialect = SQLDialect.SQLITE) -> str:
    """Escape a value for safe SQL insertion."""
    if value is None:
        return "NULL"
    
    if isinstance(value, bool):
        return "1" if value else "0"
    
    if isinstance(value, (int, float)):
        return str(value)
    
    # String escaping
    str_val = str(value)
    
    if dialect == SQLDialect.MYSQL:
        # MySQL escaping
        str_val = str_val.replace("\\", "\\\\")
        str_val = str_val.replace("'", "\\'")
        str_val = str_val.replace('"', '\\"')
        str_val = str_val.replace("\n", "\\n")
        str_val = str_val.replace("\r", "\\r")
        str_val = str_val.replace("\x00", "\\0")
    else:
        # SQLite/Postgres: double single quotes
        str_val = str_val.replace("'", "''")
    
    return f"'{str_val}'"


def safe_sql(template: Template, dialect: SQLDialect = SQLDialect.SQLITE) -> str:
    """
    Sanitize SQL query from t-string template.
    
    Prevents SQL injection by escaping all interpolated values.
    
    Example:
        user_input = "'; DROP TABLE users; --"
        query = safe_sql(t"SELECT * FROM users WHERE name = {user_input}")
        # Result: "SELECT * FROM users WHERE name = '''; DROP TABLE users; --'"
    
    Args:
        template: A t-string template
        dialect: SQL dialect for escaping rules
        
    Returns:
        Safe SQL query string
    """
    if not TSTRINGS_AVAILABLE:
        logger.warning("T-strings not available (Python < 3.14), returning as-is")
        return str(template)
    
    parts: list[str] = []
    
    for part in template:
        if isinstance(part, Interpolation):
            parts.append(_escape_sql_value(part.value, dialect))
        else:
            parts.append(str(part))
    
    return "".join(parts)


def safe_sql_identifier(name: str) -> str:
    """Sanitize SQL identifier (table/column name)."""
    # Only allow alphanumeric and underscore
    if not re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', name):
        raise ValueError(f"Invalid SQL identifier: {name}")
    return name


# ============================================================================
# HTML/XSS Sanitization
# ============================================================================

def safe_html(template: Template) -> str:
    """
    Sanitize HTML from t-string template.
    
    Prevents XSS by escaping all interpolated values.
    
    Example:
        user_input = "<script>alert('xss')</script>"
        html = safe_html(t"<div>{user_input}</div>")
        # Result: "<div>&lt;script&gt;alert('xss')&lt;/script&gt;</div>"
    
    Args:
        template: A t-string template
        
    Returns:
        Safe HTML string
    """
    if not TSTRINGS_AVAILABLE:
        logger.warning("T-strings not available (Python < 3.14), returning as-is")
        return str(template)
    
    parts: list[str] = []
    
    for part in template:
        if isinstance(part, Interpolation):
            parts.append(html.escape(str(part.value)))
        else:
            parts.append(str(part))
    
    return "".join(parts)


def safe_html_attribute(template: Template) -> str:
    """
    Sanitize HTML attribute value from t-string template.
    
    Additional escaping for attribute context.
    """
    if not TSTRINGS_AVAILABLE:
        return str(template)
    
    parts: list[str] = []
    
    for part in template:
        if isinstance(part, Interpolation):
            escaped = html.escape(str(part.value), quote=True)
            # Additional attribute escaping
            escaped = escaped.replace("`", "&#96;")
            parts.append(escaped)
        else:
            parts.append(str(part))
    
    return "".join(parts)


# ============================================================================
# Shell Command Sanitization
# ============================================================================

def safe_shell(template: Template) -> str:
    """
    Sanitize shell command from t-string template.
    
    Prevents command injection by escaping all interpolated values.
    
    Example:
        filename = "file; rm -rf /"
        cmd = safe_shell(t"cat {filename}")
        # Result: "cat 'file; rm -rf /'"
    
    Args:
        template: A t-string template
        
    Returns:
        Safe shell command string
    """
    if not TSTRINGS_AVAILABLE:
        logger.warning("T-strings not available (Python < 3.14), returning as-is")
        return str(template)
    
    parts: list[str] = []
    
    for part in template:
        if isinstance(part, Interpolation):
            parts.append(shlex.quote(str(part.value)))
        else:
            parts.append(str(part))
    
    return "".join(parts)


# ============================================================================
# Structured Logging
# ============================================================================

@dataclass
class StructuredLogEntry:
    """Structured log entry with context."""
    message: str
    context: dict[str, Any] = field(default_factory=dict)
    timestamp: datetime = field(default_factory=lambda: datetime.now(tz=None))
    level: str = "INFO"
    
    def to_dict(self) -> dict[str, Any]:
        return {
            "message": self.message,
            "context": self.context,
            "timestamp": self.timestamp.isoformat(),
            "level": self.level,
        }
    
    def to_json(self) -> str:
        return json.dumps(self.to_dict(), default=str)


def structured_log(template: Template, level: str = "INFO") -> StructuredLogEntry:
    """
    Convert t-string template to structured log entry.
    
    Extracts interpolated values as context for structured logging.
    
    Example:
        user = "alice"
        action = "login"
        entry = structured_log(t"User {user} performed {action}")
        # entry.message = "User {user} performed {action}"
        # entry.context = {"user": "alice", "action": "login"}
    
    Args:
        template: A t-string template
        level: Log level (INFO, DEBUG, WARNING, ERROR)
        
    Returns:
        StructuredLogEntry with message and context
    """
    if not TSTRINGS_AVAILABLE:
        return StructuredLogEntry(message=str(template), level=level)
    
    message_parts: list[str] = []
    context: dict[str, Any] = {}
    
    for part in template:
        if isinstance(part, Interpolation):
            # Use expression as key, value as context
            key = part.expression or f"arg_{len(context)}"
            message_parts.append(f"{{{key}}}")
            context[key] = part.value
        else:
            message_parts.append(str(part))
    
    return StructuredLogEntry(
        message="".join(message_parts),
        context=context,
        level=level,
    )


def log_with_context(
    template: Template,
    level: str = "INFO",
    logger_instance: logging.Logger | None = None,
) -> None:
    """
    Log a structured message from t-string template.
    
    Args:
        template: A t-string template
        level: Log level
        logger_instance: Logger to use (defaults to module logger)
    """
    entry = structured_log(template, level)
    log = logger_instance or logger
    
    log_method = getattr(log, level.lower(), log.info)
    log_method(entry.message, extra={"structured_context": entry.context})


# ============================================================================
# JSON Path Sanitization
# ============================================================================

def safe_json_path(template: Template) -> str:
    """
    Sanitize JSON path expression from t-string template.
    
    Prevents path traversal and injection.
    """
    if not TSTRINGS_AVAILABLE:
        return str(template)
    
    parts: list[str] = []
    
    for part in template:
        if isinstance(part, Interpolation):
            value = str(part.value)
            # Only allow safe characters in JSON path
            if not re.match(r'^[a-zA-Z0-9_\-\.]+$', value):
                raise ValueError(f"Invalid JSON path component: {value}")
            parts.append(value)
        else:
            parts.append(str(part))
    
    return "".join(parts)


# ============================================================================
# URL Sanitization
# ============================================================================

def safe_url_param(template: Template) -> str:
    """
    Sanitize URL with query parameters from t-string template.
    
    URL-encodes all interpolated values.
    """
    if not TSTRINGS_AVAILABLE:
        return str(template)
    
    from urllib.parse import quote
    
    parts: list[str] = []
    
    for part in template:
        if isinstance(part, Interpolation):
            parts.append(quote(str(part.value), safe=''))
        else:
            parts.append(str(part))
    
    return "".join(parts)


# ============================================================================
# Template Processors (Higher-Order)
# ============================================================================

def create_template_processor(
    escape_fn: Callable[[Any], str],
    static_fn: Callable[[str], str] | None = None,
) -> Callable[[Template], str]:
    """
    Create a custom template processor.
    
    Args:
        escape_fn: Function to escape interpolated values
        static_fn: Optional function to process static parts
        
    Returns:
        A template processor function
    """
    def processor(template: Template) -> str:
        if not TSTRINGS_AVAILABLE:
            return str(template)
        
        parts: list[str] = []
        
        for part in template:
            if isinstance(part, Interpolation):
                parts.append(escape_fn(part.value))
            else:
                text = str(part)
                if static_fn:
                    text = static_fn(text)
                parts.append(text)
        
        return "".join(parts)
    
    return processor


# ============================================================================
# GOGGA-Specific Prompt Sanitization
# ============================================================================

def safe_prompt(template: Template) -> str:
    """
    Sanitize AI prompt from t-string template.
    
    Prevents prompt injection by escaping control sequences.
    """
    if not TSTRINGS_AVAILABLE:
        return str(template)
    
    parts: list[str] = []
    
    for part in template:
        if isinstance(part, Interpolation):
            value = str(part.value)
            # Escape common prompt injection patterns
            value = value.replace("```", "\\`\\`\\`")
            value = value.replace("###", "\\#\\#\\#")
            value = value.replace("[INST]", "\\[INST\\]")
            value = value.replace("[/INST]", "\\[/INST\\]")
            value = value.replace("<|", "\\<\\|")
            value = value.replace("|>", "\\|\\>")
            value = value.replace("<<SYS>>", "\\<\\<SYS\\>\\>")
            value = value.replace("<</SYS>>", "\\<\\</SYS\\>\\>")
            parts.append(value)
        else:
            parts.append(str(part))
    
    return "".join(parts)


# ============================================================================
# Availability Check
# ============================================================================

def is_tstrings_available() -> bool:
    """Check if t-strings are available (Python 3.14+)."""
    return TSTRINGS_AVAILABLE


def get_python_version() -> str:
    """Get Python version string."""
    import sys
    return f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
