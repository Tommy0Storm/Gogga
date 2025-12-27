"""
GOGGA Circuit Breaker with Prometheus Metrics

Prevents cascading failures by tripping after N failures.
Includes Prometheus metrics export for monitoring.

States:
- CLOSED: Normal operation, requests pass through
- OPEN: Circuit tripped, requests fail immediately
- HALF_OPEN: Testing if service has recovered
"""

import logging
import time
import asyncio
from typing import Callable, Any, Optional
from dataclasses import dataclass, field
from enum import Enum
from functools import wraps
from collections import deque

logger = logging.getLogger(__name__)


class CircuitState(Enum):
    """Circuit breaker states."""
    CLOSED = "closed"       # Normal operation
    OPEN = "open"           # Circuit tripped
    HALF_OPEN = "half_open"  # Testing recovery


@dataclass
class CircuitBreakerMetrics:
    """Metrics for monitoring circuit breaker health."""
    service_name: str
    state: CircuitState = CircuitState.CLOSED
    failure_count: int = 0
    success_count: int = 0
    last_failure_time: Optional[float] = None
    last_success_time: Optional[float] = None
    opened_count: int = 0  # How many times circuit has opened
    closed_count: int = 0  # How many times circuit has closed (recovered)
    total_requests: int = 0
    total_failures: int = 0

    # Recent response times (last 100)
    response_times: deque = field(default_factory=lambda: deque(maxlen=100))

    def to_dict(self) -> dict:
        """Convert to dict for Prometheus export."""
        avg_response_time = (
            sum(self.response_times) / len(self.response_times)
            if self.response_times else 0
        )

        return {
            "circuit_breaker_state": self.state.value,
            "failure_count": self.failure_count,
            "success_count": self.success_count,
            "failure_rate": (
                self.total_failures / self.total_requests
                if self.total_requests > 0 else 0
            ),
            "opened_count": self.opened_count,
            "closed_count": self.closed_count,
            "total_requests": self.total_requests,
            "avg_response_time_ms": avg_response_time,
        }

    def to_prometheus(self) -> str:
        """Export metrics in Prometheus text format."""
        metrics = self.to_dict()

        prometheus_lines = [
            f"# HELP circuit_breaker_state Circuit breaker state (0=closed, 1=open, 2=half_open)",
            f"# TYPE circuit_breaker_state gauge",
            f"circuit_breaker_state{{service=\"{self.service_name}\"}} {metrics['circuit_breaker_state'].value}",

            f"\n# HELP circuit_breaker_failures Total number of failures",
            f"# TYPE circuit_breaker_failures counter",
            f"circuit_breaker_failures{{service=\"{self.service_name}\"}} {metrics['total_failures']}",

            f"\n# HELP circuit_breaker_successes Total number of successes",
            f"# TYPE circuit_breaker_successes counter",
            f"circuit_breaker_successes{{service=\"{self.service_name}\"}} {metrics['success_count']}",

            f"\n# HELP circuit_breaker_failure_rate Failure rate (0-1)",
            f"# TYPE circuit_breaker_failure_rate gauge",
            f"circuit_breaker_failure_rate{{service=\"{self.service_name}\"}} {metrics['failure_rate']:.4f}",

            f"\n# HELP circuit_breaker_opened_total Number of times circuit opened",
            f"# TYPE circuit_breaker_opened_total counter",
            f"circuit_breaker_opened_total{{service=\"{self.service_name}\"}} {metrics['opened_count']}",

            f"\n# HELP circuit_breaker_avg_response_time_ms Average response time in milliseconds",
            f"# TYPE circuit_breaker_avg_response_time_ms gauge",
            f"circuit_breaker_avg_response_time_ms{{service=\"{self.service_name}\"}} {metrics['avg_response_time_ms']:.2f}",
        ]

        return "\n".join(prometheus_lines)


class CircuitBreakerError(Exception):
    """Raised when circuit breaker is OPEN."""
    pass


class CircuitBreaker:
    """
    Circuit Breaker Pattern Implementation with Metrics.

    Usage:
        breaker = CircuitBreaker(
            service_name="cerebras_api",
            failure_threshold=5,
            timeout=60
        )

        try:
            result = await breaker.call(cerebras_client.generate, prompt="Hello")
        except CircuitBreakerError:
            # Circuit is open, use fallback
            result = await fallback_service.generate(prompt="Hello")
    """

    def __init__(
        self,
        service_name: str,
        failure_threshold: int = 5,
        timeout: int = 60,
        half_open_max_calls: int = 3,
        reset_timeout: int = 60
    ):
        """
        Initialize circuit breaker.

        Args:
            service_name: Name of the service being protected
            failure_threshold: Number of failures before tripping
            timeout: Seconds to wait before transitioning from OPEN to HALF_OPEN
            half_open_max_calls: Max calls allowed in HALF_OPEN state
            reset_timeout: Seconds before auto-reset from HALF_OPEN to CLOSED
        """
        self.service_name = service_name
        self.failure_threshold = failure_threshold
        self.timeout = timeout
        self.half_open_max_calls = half_open_max_calls
        self.reset_timeout = reset_timeout

        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.last_failure_time: Optional[float] = None
        self.half_open_calls = 0

        self.metrics = CircuitBreakerMetrics(service_name=service_name)

        logger.info(
            f"[CircuitBreaker] Initialized for {service_name}: "
            f"threshold={failure_threshold}, timeout={timeout}s"
        )

    def _should_attempt_reset(self) -> bool:
        """Check if enough time has passed to attempt reset."""
        if self.last_failure_time is None:
            return True

        return time.time() - self.last_failure_time >= self.timeout

    def _record_success(self, response_time_ms: float):
        """Record successful call."""
        self.failure_count = 0
        self.metrics.success_count += 1
        self.metrics.last_success_time = time.time()
        self.metrics.response_times.append(response_time_ms)

        if self.state == CircuitState.HALF_OPEN:
            self.half_open_calls += 1
            if self.half_open_calls >= self.half_open_max_calls:
                # Circuit has recovered
                self.state = CircuitState.CLOSED
                self.metrics.closed_count += 1
                self.half_open_calls = 0
                logger.info(
                    f"[CircuitBreaker] {self.service_name}: "
                    f"HALF_OPEN → CLOSED (recovered after {self.half_open_max_calls} successes)"
                )

    def _record_failure(self):
        """Record failed call."""
        self.failure_count += 1
        self.metrics.failure_count = self.failure_count
        self.metrics.last_failure_time = time.time()
        self.metrics.total_failures += 1

        if self.failure_count >= self.failure_threshold:
            if self.state != CircuitState.OPEN:
                # Trip the circuit
                self.state = CircuitState.OPEN
                self.metrics.opened_count += 1
                logger.error(
                    f"[CircuitBreaker] {self.service_name}: "
                    f"CLOSED → OPEN (threshold reached: {self.failure_count}/{self.failure_threshold})"
                )

    async def call(
        self,
        func: Callable,
        *args: Any,
        **kwargs: Any
    ) -> Any:
        """
        Execute function through circuit breaker.

        Args:
            func: Function to call
            *args: Positional arguments for func
            **kwargs: Keyword arguments for func

        Returns:
            Result of func(*args, **kwargs)

        Raises:
            CircuitBreakerError: If circuit is OPEN
            Exception: If func raises an exception (and circuit allows)
        """
        self.metrics.total_requests += 1
        start_time = time.time()

        # Check circuit state
        if self.state == CircuitState.OPEN:
            if self._should_attempt_reset():
                # Transition to HALF_OPEN to test recovery
                self.state = CircuitState.HALF_OPEN
                self.half_open_calls = 0
                logger.info(
                    f"[CircuitBreaker] {self.service_name}: "
                    f"OPEN → HALF_OPEN (testing recovery)"
                )
            else:
                # Circuit is still open
                logger.warning(
                    f"[CircuitBreaker] {self.service_name}: "
                    f"OPEN - rejecting request (retry in {int(self.timeout - (time.time() - self.last_failure_time))}s)"
                )
                raise CircuitBreakerError(
                    f"Circuit breaker is OPEN for {self.service_name}. "
                    f"Retry in {self.timeout} seconds."
                )

        try:
            # Execute the function
            if asyncio.iscoroutinefunction(func):
                result = await func(*args, **kwargs)
            else:
                result = func(*args, **kwargs)

            # Record success
            response_time_ms = (time.time() - start_time) * 1000
            self._record_success(response_time_ms)

            return result

        except Exception as e:
            # Record failure
            self._record_failure()

            # If in HALF_OPEN and failed, go back to OPEN
            if self.state == CircuitState.HALF_OPEN:
                self.state = CircuitState.OPEN
                logger.warning(
                    f"[CircuitBreaker] {self.service_name}: "
                    f"HALF_OPEN → OPEN (recovery test failed)"
                )

            logger.error(
                f"[CircuitBreaker] {self.service_name}: "
                f"Request failed (failure_count={self.failure_count}/{self.failure_threshold}): {e}"
            )
            raise

    def get_metrics(self) -> CircuitBreakerMetrics:
        """Get current metrics."""
        return self.metrics

    def reset(self):
        """Manually reset circuit breaker to CLOSED state."""
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.last_failure_time = None
        self.half_open_calls = 0
        logger.info(f"[CircuitBreaker] {self.service_name}: Manual reset to CLOSED")


class CircuitBreakerRegistry:
    """Registry for managing multiple circuit breakers."""

    _instance: Optional['CircuitBreakerRegistry'] = None
    _breakers: dict[str, CircuitBreaker] = {}

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def register(self, breaker: CircuitBreaker):
        """Register a circuit breaker."""
        self._breakers[breaker.service_name] = breaker
        logger.info(f"[CircuitBreaker] Registered: {breaker.service_name}")

    def get(self, service_name: str) -> Optional[CircuitBreaker]:
        """Get a circuit breaker by name."""
        return self._breakers.get(service_name)

    def get_all_metrics(self) -> dict[str, CircuitBreakerMetrics]:
        """Get metrics for all registered circuit breakers."""
        return {
            name: breaker.get_metrics()
            for name, breaker in self._breakers.items()
        }

    def export_all_prometheus(self) -> str:
        """Export all circuit breaker metrics in Prometheus format."""
        lines = [
            "# =============================================================================",
            "# GOGGA Circuit Breaker Metrics",
            f"# Generated at: {time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime())}",
            "# =============================================================================",
            ""
        ]

        for breaker in self._breakers.values():
            lines.append(f"# {breaker.service_name}")
            lines.append(breaker.get_metrics().to_prometheus())
            lines.append("")

        return "\n".join(lines)

    def reset_all(self):
        """Reset all circuit breakers."""
        for breaker in self._breakers.values():
            breaker.reset()
        logger.info("[CircuitBreaker] All circuit breakers reset")


def circuit_breaker_decorator(
    service_name: str,
    failure_threshold: int = 5,
    timeout: int = 60
):
    """
    Decorator for automatic circuit breaker protection.

    Usage:
        @circuit_breaker_decorator("cerebras_api", failure_threshold=5, timeout=60)
        async def call_cerebras(prompt: str):
            return await cerebras_client.generate(prompt)
    """
    registry = CircuitBreakerRegistry()

    def decorator(func: Callable) -> Callable:
        # Get or create circuit breaker
        breaker = registry.get(service_name)
        if breaker is None:
            breaker = CircuitBreaker(
                service_name=service_name,
                failure_threshold=failure_threshold,
                timeout=timeout
            )
            registry.register(breaker)

        @wraps(func)
        async def wrapper(*args, **kwargs):
            return await breaker.call(func, *args, **kwargs)

        return wrapper

    return decorator


# Singleton instance
circuit_breaker_registry = CircuitBreakerRegistry()


def get_circuit_breaker_registry() -> CircuitBreakerRegistry:
    """Get the global circuit breaker registry."""
    return circuit_breaker_registry
