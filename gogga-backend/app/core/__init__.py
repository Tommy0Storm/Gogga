"""
GOGGA Core Module
Contains core utilities, routing logic, and exception handling.
"""
from app.core.router import BicameralRouter, CognitiveLayer, bicameral_router
from app.core.exceptions import (
    GoggaException,
    InferenceError,
    PaymentError,
    RateLimitError,
    QuotaExceededError,
)
from app.core.retry import (
    RetryConfig,
    with_retry,
    imagen_circuit,
    veo_circuit,
    RetryableError,
    NonRetryableError,
    DEFAULT_RETRY_CONFIG,
)
from app.core.idempotency import (
    IdempotencyCache,
    CachedResponse,
    imagen_idempotency,
    veo_idempotency,
    validate_idempotency_key,
)

__all__ = [
    "BicameralRouter",
    "CognitiveLayer",
    "bicameral_router",
    "GoggaException",
    "InferenceError",
    "PaymentError",
    "RateLimitError",
    "QuotaExceededError",
    # Retry utilities
    "RetryConfig",
    "with_retry",
    "imagen_circuit",
    "veo_circuit",
    "RetryableError",
    "NonRetryableError",
    "DEFAULT_RETRY_CONFIG",
    # Idempotency utilities
    "IdempotencyCache",
    "CachedResponse",
    "imagen_idempotency",
    "veo_idempotency",
    "validate_idempotency_key",
]
