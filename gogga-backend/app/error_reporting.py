"""
GOGGA Enhanced Error Reporting System - Python 3.14

Structured error handling matching TypeScript frontend types.

Python 3.14 Features:
- Enhanced exception groups for better error context
- Improved type hints with PEP 695 (type statement)
- Better stack trace formatting
- Async exception handling improvements
"""
from __future__ import annotations

import sys
import traceback
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Literal, TypeAlias
from uuid import uuid4

from fastapi import HTTPException, status
from pydantic import BaseModel, Field


# ============================================================================
# Error Types (matches TypeScript APIError discriminated union)
# ============================================================================

class ErrorType(str, Enum):
    """Error type enumeration matching TypeScript."""
    VALIDATION_ERROR = "validation_error"
    AUTHENTICATION_ERROR = "authentication_error"
    RATE_LIMIT_ERROR = "rate_limit_error"
    TIER_LIMIT_ERROR = "tier_limit_error"
    SERVICE_ERROR = "service_error"
    INTERNAL_ERROR = "internal_error"


# Python 3.14: Type aliases with PEP 695 syntax (cleaner than TypeAlias)
type UserTier = Literal["free", "jive", "jigga"]
type AIProvider = Literal["cerebras", "openrouter", "groq", "deepinfra", "cerebras+cepo", "pollinations", "flux"]


# ============================================================================
# Error Context (matches TypeScript ErrorContext)
# ============================================================================

@dataclass
class ErrorContext:
    """Rich context for error tracking and debugging."""
    request_id: str = field(default_factory=lambda: str(uuid4()))
    timestamp: datetime = field(default_factory=datetime.utcnow)
    tier: UserTier = "free"
    layer: str | None = None
    provider: AIProvider | None = None
    endpoint: str | None = None
    method: str = "GET"
    metadata: dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "request_id": self.request_id,
            "timestamp": self.timestamp.isoformat(),
            "tier": self.tier,
            "layer": self.layer,
            "provider": self.provider,
            "endpoint": self.endpoint,
            "method": self.method,
            "metadata": self.metadata,
        }


# ============================================================================
# Stack Frame (Python 3.14 enhanced traceback)
# ============================================================================

@dataclass(frozen=True)
class StackFrame:
    """Structured stack frame information."""
    file_name: str
    line_number: int
    function_name: str
    source: str | None = None
    
    @classmethod
    def from_traceback(cls, tb: traceback.FrameSummary) -> StackFrame:
        """Create from traceback frame."""
        return cls(
            file_name=tb.filename,
            line_number=tb.lineno,
            function_name=tb.name,
            source=tb.line,
        )


# ============================================================================
# Base Gogga Exception (Python 3.14 enhanced exception groups)
# ============================================================================

class GoggaException(Exception):
    """
    Base exception class with rich context.
    
    Python 3.14 features:
    - Enhanced exception groups support
    - Better stack trace formatting
    - Automatic request ID tracking
    """
    
    def __init__(
        self,
        message: str,
        code: str,
        context: ErrorContext,
        *,
        recoverable: bool = True,
        retryable: bool = False,
        user_message: str | None = None,
    ):
        super().__init__(message)
        self.message = message
        self.code = code
        self.context = context
        self.recoverable = recoverable
        self.retryable = retryable
        self.user_message = user_message or "Something went wrong. Please try again."
        
        # Python 3.14: Enhanced stack trace capture
        self.stack_frames = self._capture_stack_frames()
    
    def _capture_stack_frames(self) -> list[StackFrame]:
        """
        Capture stack frames with Python 3.14 enhanced traceback.
        
        Python 3.14: More efficient stack capture with better formatting
        """
        frames: list[StackFrame] = []
        
        # Python 3.14: traceback.extract_stack() improvements
        stack = traceback.extract_stack()[:-1]  # Exclude this function
        for frame in stack:
            frames.append(StackFrame.from_traceback(frame))
        
        return frames
    
    def to_api_error(self) -> dict[str, Any]:
        """Convert to API error response format (matches TypeScript APIError)."""
        return {
            "type": "internal_error",
            "error": self.message,
            "detail": self.user_message,
            "request_id": self.context.request_id,
            "timestamp": self.context.timestamp.isoformat(),
            "error_code": self.code,
        }
    
    def to_http_exception(self) -> HTTPException:
        """Convert to FastAPI HTTPException."""
        return HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=self.to_api_error(),
        )
    
    def __repr__(self) -> str:
        """Python 3.14: Enhanced repr with rich context."""
        return (
            f"{self.__class__.__name__}("
            f"code={self.code!r}, "
            f"message={self.message!r}, "
            f"request_id={self.context.request_id!r})"
        )


# ============================================================================
# Specific Exception Classes (matches TypeScript error types)
# ============================================================================

class ValidationException(GoggaException):
    """Validation error with field-level errors."""
    
    def __init__(
        self,
        message: str,
        field_errors: dict[str, list[str]],
        context: ErrorContext,
    ):
        super().__init__(
            message,
            "VALIDATION_ERROR",
            context,
            recoverable=True,
            retryable=False,
            user_message="Please check your input and try again.",
        )
        self.field_errors = field_errors
    
    def to_api_error(self) -> dict[str, Any]:
        """Override to include field errors."""
        base = super().to_api_error()
        base["type"] = "validation_error"
        base["field_errors"] = self.field_errors
        return base
    
    def to_http_exception(self) -> HTTPException:
        """422 Unprocessable Entity for validation errors."""
        return HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=self.to_api_error(),
        )


class AuthenticationException(GoggaException):
    """Authentication/authorization error."""
    
    def __init__(
        self,
        message: str,
        required_tier: UserTier | None,
        context: ErrorContext,
    ):
        user_msg = (
            f"This feature requires {required_tier.upper()} tier."
            if required_tier
            else "Authentication required."
        )
        super().__init__(
            message,
            "AUTH_ERROR",
            context,
            recoverable=False,
            retryable=False,
            user_message=user_msg,
        )
        self.required_tier = required_tier
    
    def to_api_error(self) -> dict[str, Any]:
        """Override to include required tier."""
        base = super().to_api_error()
        base["type"] = "authentication_error"
        if self.required_tier:
            base["required_tier"] = self.required_tier
        return base
    
    def to_http_exception(self) -> HTTPException:
        """401 Unauthorized or 403 Forbidden."""
        status_code = (
            status.HTTP_403_FORBIDDEN
            if self.required_tier
            else status.HTTP_401_UNAUTHORIZED
        )
        return HTTPException(status_code=status_code, detail=self.to_api_error())


class RateLimitException(GoggaException):
    """Rate limit exceeded error."""
    
    def __init__(
        self,
        message: str,
        retry_after: int,
        limit_reset: datetime,
        context: ErrorContext,
    ):
        super().__init__(
            message,
            "RATE_LIMIT",
            context,
            recoverable=True,
            retryable=True,
            user_message=f"Rate limit exceeded. Please try again in {retry_after} seconds.",
        )
        self.retry_after = retry_after
        self.limit_reset = limit_reset
    
    def to_api_error(self) -> dict[str, Any]:
        """Override to include retry info."""
        base = super().to_api_error()
        base["type"] = "rate_limit_error"
        base["retry_after"] = self.retry_after
        base["limit_reset"] = self.limit_reset.isoformat()
        return base
    
    def to_http_exception(self) -> HTTPException:
        """429 Too Many Requests."""
        return HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=self.to_api_error(),
            headers={"Retry-After": str(self.retry_after)},
        )


class TierLimitException(GoggaException):
    """Tier limit reached error."""
    
    def __init__(
        self,
        message: str,
        current_usage: int,
        tier_limit: int,
        upgrade_tier: UserTier | None,
        context: ErrorContext,
    ):
        user_msg = (
            f"You've reached your tier limit. Upgrade to {upgrade_tier.upper()} for more."
            if upgrade_tier
            else "You've reached your tier limit."
        )
        super().__init__(
            message,
            "TIER_LIMIT",
            context,
            recoverable=False,
            retryable=False,
            user_message=user_msg,
        )
        self.current_usage = current_usage
        self.tier_limit = tier_limit
        self.upgrade_tier = upgrade_tier
    
    def to_api_error(self) -> dict[str, Any]:
        """Override to include usage info."""
        base = super().to_api_error()
        base["type"] = "tier_limit_error"
        base["current_usage"] = self.current_usage
        base["tier_limit"] = self.tier_limit
        if self.upgrade_tier:
            base["upgrade_tier"] = self.upgrade_tier
        return base
    
    def to_http_exception(self) -> HTTPException:
        """402 Payment Required."""
        return HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=self.to_api_error(),
        )


class ServiceException(GoggaException):
    """External service error."""
    
    def __init__(
        self,
        message: str,
        service: AIProvider,
        fallback_used: bool,
        context: ErrorContext,
    ):
        user_msg = (
            "Using backup service. Response may be slower."
            if fallback_used
            else "AI service temporarily unavailable. Please try again."
        )
        super().__init__(
            message,
            "SERVICE_ERROR",
            context,
            recoverable=True,
            retryable=True,
            user_message=user_msg,
        )
        self.service = service
        self.fallback_used = fallback_used
    
    def to_api_error(self) -> dict[str, Any]:
        """Override to include service info."""
        base = super().to_api_error()
        base["type"] = "service_error"
        base["service"] = self.service
        base["fallback_used"] = self.fallback_used
        return base
    
    def to_http_exception(self) -> HTTPException:
        """503 Service Unavailable or 200 OK if fallback used."""
        status_code = (
            status.HTTP_200_OK
            if self.fallback_used
            else status.HTTP_503_SERVICE_UNAVAILABLE
        )
        return HTTPException(status_code=status_code, detail=self.to_api_error())


# ============================================================================
# Error Recovery Utilities (Python 3.14 async improvements)
# ============================================================================

@dataclass
class RetryConfig:
    """Retry configuration matching TypeScript."""
    max_attempts: int = 3
    base_delay: float = 1.0  # seconds
    max_delay: float = 10.0  # seconds
    exponential_backoff: bool = True
    retryable_errors: set[str] = field(
        default_factory=lambda: {"NETWORK_ERROR", "SERVICE_ERROR", "RATE_LIMIT"}
    )


async def with_retry[T](
    func: callable[[], Awaitable[T]],
    config: RetryConfig = RetryConfig(),
) -> T:
    """
    Execute async function with retry logic.
    
    Python 3.14: Using PEP 695 generic function syntax for better type inference
    """
    import asyncio
    
    last_error: GoggaException | None = None
    
    for attempt in range(1, config.max_attempts + 1):
        try:
            return await func()
        except GoggaException as error:
            last_error = error
            
            # Check if error is retryable
            if not error.retryable or error.code not in config.retryable_errors:
                raise
            
            # Check if max attempts reached
            if attempt >= config.max_attempts:
                raise
            
            # Calculate delay with exponential backoff
            if config.exponential_backoff:
                delay = min(config.base_delay * (2 ** (attempt - 1)), config.max_delay)
            else:
                delay = config.base_delay
            
            # Wait before retry
            await asyncio.sleep(delay)
    
    # Should never reach here, but satisfy type checker
    if last_error:
        raise last_error
    raise RuntimeError("Unexpected state in with_retry")


# ============================================================================
# Error Logging (Python 3.14 structured logging)
# ============================================================================

class ErrorLogger:
    """
    Error logger with batching and async flush.
    
    Python 3.14: Using async improvements for better performance
    """
    
    def __init__(self, endpoint: str | None = None, batch_size: int = 10):
        self.endpoint = endpoint
        self.batch_size = batch_size
        self.queue: list[dict[str, Any]] = []
    
    def log(self, error: GoggaException) -> None:
        """Log error to queue."""
        error_data = {
            "code": error.code,
            "message": error.message,
            "user_message": error.user_message,
            "context": error.context.to_dict(),
            "stack_frames": [
                {
                    "file_name": frame.file_name,
                    "line_number": frame.line_number,
                    "function_name": frame.function_name,
                    "source": frame.source,
                }
                for frame in error.stack_frames[:5]  # First 5 frames
            ],
            "recoverable": error.recoverable,
            "retryable": error.retryable,
        }
        
        self.queue.append(error_data)
        
        # Auto-flush if batch size reached
        if len(self.queue) >= self.batch_size:
            import asyncio
            # Python 3.14: Better task creation for background tasks
            asyncio.create_task(self.flush())
    
    async def flush(self) -> None:
        """Flush queued errors to endpoint."""
        if not self.queue or not self.endpoint:
            return
        
        batch = self.queue[:]
        self.queue.clear()
        
        try:
            import httpx
            async with httpx.AsyncClient() as client:
                await client.post(
                    self.endpoint,
                    json={
                        "errors": batch,
                        "timestamp": datetime.utcnow().isoformat(),
                    },
                    timeout=5.0,
                )
        except Exception as e:
            # Re-queue on failure
            self.queue.extend(batch)
            print(f"Failed to send error batch: {e}", file=sys.stderr)


# Global error logger instance
_global_logger = ErrorLogger()


def set_error_logger(logger: ErrorLogger) -> None:
    """Set global error logger."""
    global _global_logger
    _global_logger = logger


def log_error(error: GoggaException) -> None:
    """Log error using global logger."""
    _global_logger.log(error)
