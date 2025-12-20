"""
Enterprise-grade retry utility for GOGGA.

Implements exponential backoff with jitter for robust API resilience.

Configuration (per user spec):
- initial_delay: 1000ms (1 second)
- multiplier: 2x exponential growth
- max_delay: 8000ms (8 seconds cap)
- jitter: random(0, 250ms) to prevent thundering herd
- max_attempts: 5 total attempts

Retry conditions:
- HTTP 429 (Rate Limited)
- HTTP 5xx (Server Errors)
- Network timeouts/connection errors
"""

import asyncio
import logging
import random
import time
from functools import wraps
from typing import Any, Callable, TypeVar

import httpx

logger = logging.getLogger(__name__)

# Type variable for generic return types
T = TypeVar("T")


class RetryConfig:
    """Configuration for retry behavior."""
    
    def __init__(
        self,
        initial_delay_ms: int = 1000,
        multiplier: float = 2.0,
        max_delay_ms: int = 8000,
        jitter_max_ms: int = 250,
        max_attempts: int = 5,
    ) -> None:
        self.initial_delay_ms = initial_delay_ms
        self.multiplier = multiplier
        self.max_delay_ms = max_delay_ms
        self.jitter_max_ms = jitter_max_ms
        self.max_attempts = max_attempts
    
    def get_delay_ms(self, attempt: int) -> int:
        """
        Calculate delay for given attempt (0-indexed).
        
        Formula: min(initial * multiplier^attempt, max) + random(0, jitter)
        """
        base_delay = self.initial_delay_ms * (self.multiplier ** attempt)
        capped_delay = min(base_delay, self.max_delay_ms)
        jitter = random.randint(0, self.jitter_max_ms)
        return int(capped_delay + jitter)


# Default retry configuration per user specification
DEFAULT_RETRY_CONFIG = RetryConfig(
    initial_delay_ms=1000,
    multiplier=2.0,
    max_delay_ms=8000,
    jitter_max_ms=250,
    max_attempts=5,
)


class RetryableError(Exception):
    """Exception indicating a retryable error occurred."""
    
    def __init__(self, message: str, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code


class NonRetryableError(Exception):
    """Exception indicating a non-retryable error (e.g., 400, 403, 404)."""
    
    def __init__(self, message: str, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code


def is_retryable_status(status_code: int) -> bool:
    """Determine if HTTP status code warrants retry."""
    return status_code == 429 or (500 <= status_code < 600)


def is_retryable_exception(exc: Exception) -> bool:
    """Determine if exception warrants retry."""
    if isinstance(exc, RetryableError):
        return True
    if isinstance(exc, httpx.HTTPStatusError):
        return is_retryable_status(exc.response.status_code)
    if isinstance(exc, (httpx.TimeoutException, httpx.ConnectError, httpx.ReadError)):
        return True
    if isinstance(exc, asyncio.TimeoutError):
        return True
    return False


def with_retry(
    config: RetryConfig | None = None,
    operation_name: str = "operation",
) -> Callable[[Callable[..., T]], Callable[..., T]]:
    """
    Decorator for adding retry logic to async functions.
    
    Usage:
        @with_retry(operation_name="imagen_generate")
        async def generate_image(self, request): ...
    
    Args:
        config: RetryConfig instance (defaults to DEFAULT_RETRY_CONFIG)
        operation_name: Human-readable name for logging
    
    Returns:
        Decorated async function with retry logic
    """
    if config is None:
        config = DEFAULT_RETRY_CONFIG
    
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> T:
            last_exception: Exception | None = None
            
            for attempt in range(config.max_attempts):
                try:
                    return await func(*args, **kwargs)
                    
                except Exception as exc:
                    last_exception = exc
                    
                    if not is_retryable_exception(exc):
                        logger.warning(
                            "%s failed with non-retryable error: %s",
                            operation_name,
                            str(exc),
                        )
                        raise
                    
                    if attempt == config.max_attempts - 1:
                        logger.error(
                            "%s failed after %d attempts: %s",
                            operation_name,
                            config.max_attempts,
                            str(exc),
                        )
                        raise
                    
                    delay_ms = config.get_delay_ms(attempt)
                    
                    # Extract status code for logging
                    status_code = "N/A"
                    if isinstance(exc, httpx.HTTPStatusError):
                        status_code = str(exc.response.status_code)
                    elif isinstance(exc, RetryableError) and exc.status_code:
                        status_code = str(exc.status_code)
                    
                    logger.warning(
                        "%s attempt %d/%d failed (status=%s). Retrying in %dms: %s",
                        operation_name,
                        attempt + 1,
                        config.max_attempts,
                        status_code,
                        delay_ms,
                        str(exc),
                    )
                    
                    await asyncio.sleep(delay_ms / 1000)
            
            # Should never reach here, but satisfy type checker
            if last_exception:
                raise last_exception
            raise RuntimeError(f"{operation_name} failed unexpectedly")
        
        return wrapper  # type: ignore[return-value]
    
    return decorator


class CircuitBreaker:
    """
    Simple circuit breaker for sustained error protection.
    
    Opens after `failure_threshold` consecutive failures.
    Stays open for `reset_timeout_seconds` before allowing retry.
    """
    
    def __init__(
        self,
        failure_threshold: int = 5,
        reset_timeout_seconds: float = 30.0,
        name: str = "circuit",
    ) -> None:
        self.failure_threshold = failure_threshold
        self.reset_timeout_seconds = reset_timeout_seconds
        self.name = name
        
        self._failure_count = 0
        self._last_failure_time: float | None = None
        self._is_open = False
    
    @property
    def is_open(self) -> bool:
        """Check if circuit is open (blocking requests)."""
        if not self._is_open:
            return False
        
        # Check if reset timeout has passed
        if self._last_failure_time:
            elapsed = time.time() - self._last_failure_time
            if elapsed >= self.reset_timeout_seconds:
                logger.info("Circuit breaker %s reset after %ds", self.name, elapsed)
                self._is_open = False
                self._failure_count = 0
                return False
        
        return True
    
    def record_success(self) -> None:
        """Record successful call, reset failure count."""
        self._failure_count = 0
        self._is_open = False
    
    def record_failure(self) -> None:
        """Record failed call, potentially open circuit."""
        self._failure_count += 1
        self._last_failure_time = time.time()
        
        if self._failure_count >= self.failure_threshold:
            self._is_open = True
            logger.warning(
                "Circuit breaker %s OPEN after %d consecutive failures",
                self.name,
                self._failure_count,
            )


# Singleton circuit breakers for critical services
imagen_circuit = CircuitBreaker(name="imagen", failure_threshold=5, reset_timeout_seconds=30)
veo_circuit = CircuitBreaker(name="veo", failure_threshold=3, reset_timeout_seconds=60)


def check_circuit(circuit: CircuitBreaker) -> None:
    """Raise if circuit is open."""
    if circuit.is_open:
        raise NonRetryableError(
            f"Service temporarily unavailable (circuit breaker open for {circuit.name})",
            status_code=503,
        )
