"""
Tests for the retry utility module.

Tests exponential backoff, circuit breaker, and retry decorator.
"""

import asyncio
import pytest
from unittest.mock import AsyncMock, patch

from app.core.retry import (
    RetryConfig,
    with_retry,
    CircuitBreaker,
    RetryableError,
    NonRetryableError,
    is_retryable_status,
    DEFAULT_RETRY_CONFIG,
)
from app.core.idempotency import (
    IdempotencyCache,
    validate_idempotency_key,
)


class TestRetryConfig:
    """Tests for RetryConfig class."""
    
    def test_default_config_values(self):
        """Verify default config matches specification."""
        config = DEFAULT_RETRY_CONFIG
        assert config.initial_delay_ms == 1000
        assert config.multiplier == 2.0
        assert config.max_delay_ms == 8000
        assert config.jitter_max_ms == 250
        assert config.max_attempts == 5
    
    def test_delay_calculation_exponential(self):
        """Test exponential backoff calculation."""
        config = RetryConfig(
            initial_delay_ms=1000,
            multiplier=2.0,
            max_delay_ms=8000,
            jitter_max_ms=0,  # No jitter for deterministic test
        )
        
        # Attempt 0: 1000ms
        assert config.get_delay_ms(0) == 1000
        # Attempt 1: 2000ms
        assert config.get_delay_ms(1) == 2000
        # Attempt 2: 4000ms
        assert config.get_delay_ms(2) == 4000
        # Attempt 3: 8000ms (capped)
        assert config.get_delay_ms(3) == 8000
        # Attempt 4: 8000ms (still capped)
        assert config.get_delay_ms(4) == 8000
    
    def test_delay_with_jitter(self):
        """Test jitter is applied within bounds."""
        config = RetryConfig(
            initial_delay_ms=1000,
            multiplier=2.0,
            max_delay_ms=8000,
            jitter_max_ms=250,
        )
        
        delays = [config.get_delay_ms(0) for _ in range(100)]
        
        # All delays should be between 1000 and 1250
        assert all(1000 <= d <= 1250 for d in delays)
        # Should have some variation (not all the same)
        assert len(set(delays)) > 1


class TestRetryableStatus:
    """Tests for is_retryable_status function."""
    
    def test_429_is_retryable(self):
        assert is_retryable_status(429) is True
    
    def test_5xx_are_retryable(self):
        for code in [500, 502, 503, 504]:
            assert is_retryable_status(code) is True
    
    def test_4xx_not_retryable(self):
        for code in [400, 401, 403, 404]:
            assert is_retryable_status(code) is False
    
    def test_2xx_not_retryable(self):
        for code in [200, 201, 204]:
            assert is_retryable_status(code) is False


class TestCircuitBreaker:
    """Tests for CircuitBreaker class."""
    
    def test_initial_state_closed(self):
        """Circuit starts closed."""
        circuit = CircuitBreaker(failure_threshold=3)
        assert circuit.is_open is False
    
    def test_opens_after_threshold(self):
        """Circuit opens after consecutive failures."""
        circuit = CircuitBreaker(failure_threshold=3, reset_timeout_seconds=30)
        
        circuit.record_failure()
        assert circuit.is_open is False
        
        circuit.record_failure()
        assert circuit.is_open is False
        
        circuit.record_failure()
        assert circuit.is_open is True
    
    def test_resets_on_success(self):
        """Success resets failure count."""
        circuit = CircuitBreaker(failure_threshold=3)
        
        circuit.record_failure()
        circuit.record_failure()
        circuit.record_success()
        circuit.record_failure()
        
        assert circuit.is_open is False
    
    def test_auto_reset_after_timeout(self):
        """Circuit resets after timeout."""
        circuit = CircuitBreaker(failure_threshold=2, reset_timeout_seconds=0.1)
        
        circuit.record_failure()
        circuit.record_failure()
        assert circuit.is_open is True
        
        # Wait for reset
        import time
        time.sleep(0.15)
        
        assert circuit.is_open is False


class TestWithRetryDecorator:
    """Tests for @with_retry decorator."""
    
    @pytest.mark.asyncio
    async def test_success_no_retry(self):
        """Successful call doesn't retry."""
        call_count = 0
        
        @with_retry(config=RetryConfig(max_attempts=3))
        async def success_func():
            nonlocal call_count
            call_count += 1
            return "success"
        
        result = await success_func()
        
        assert result == "success"
        assert call_count == 1
    
    @pytest.mark.asyncio
    async def test_retry_on_retryable_error(self):
        """Retries on RetryableError."""
        call_count = 0
        
        @with_retry(config=RetryConfig(max_attempts=3, initial_delay_ms=10, jitter_max_ms=0))
        async def flaky_func():
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise RetryableError("transient error", status_code=503)
            return "success"
        
        result = await flaky_func()
        
        assert result == "success"
        assert call_count == 3
    
    @pytest.mark.asyncio
    async def test_no_retry_on_non_retryable_error(self):
        """Does not retry on NonRetryableError."""
        call_count = 0
        
        @with_retry(config=RetryConfig(max_attempts=3))
        async def bad_request():
            nonlocal call_count
            call_count += 1
            raise NonRetryableError("bad request", status_code=400)
        
        with pytest.raises(NonRetryableError):
            await bad_request()
        
        assert call_count == 1
    
    @pytest.mark.asyncio
    async def test_exhausts_all_attempts(self):
        """After max_attempts, raises the error."""
        call_count = 0
        
        @with_retry(config=RetryConfig(max_attempts=3, initial_delay_ms=10, jitter_max_ms=0))
        async def always_fail():
            nonlocal call_count
            call_count += 1
            raise RetryableError("always fails", status_code=503)
        
        with pytest.raises(RetryableError):
            await always_fail()
        
        assert call_count == 3


class TestIdempotencyCache:
    """Tests for IdempotencyCache class."""
    
    @pytest.mark.asyncio
    async def test_set_and_get(self):
        """Can set and retrieve cached response."""
        cache = IdempotencyCache(ttl_seconds=60)
        
        await cache.set("key1", {"result": "data"})
        result = await cache.get("key1")
        
        assert result == {"result": "data"}
    
    @pytest.mark.asyncio
    async def test_cache_miss_returns_none(self):
        """Missing key returns None."""
        cache = IdempotencyCache()
        result = await cache.get("nonexistent")
        assert result is None
    
    @pytest.mark.asyncio
    async def test_expired_entry_returns_none(self):
        """Expired entries are not returned."""
        cache = IdempotencyCache(ttl_seconds=0.05)  # 50ms TTL
        
        await cache.set("key1", "value1")
        
        import time
        time.sleep(0.1)  # Wait for expiry
        
        result = await cache.get("key1")
        assert result is None


class TestValidateIdempotencyKey:
    """Tests for validate_idempotency_key function."""
    
    def test_valid_uuid_v4(self):
        """Valid UUID v4 is accepted."""
        key = "550e8400-e29b-41d4-a716-446655440000"
        assert validate_idempotency_key(key) == key.lower()
    
    def test_uppercase_normalized(self):
        """Uppercase UUIDs are lowercased."""
        key = "550E8400-E29B-41D4-A716-446655440000"
        assert validate_idempotency_key(key) == key.lower()
    
    def test_invalid_uuid_returns_none(self):
        """Invalid format returns None."""
        assert validate_idempotency_key("not-a-uuid") is None
        assert validate_idempotency_key("12345") is None
    
    def test_none_returns_none(self):
        """None input returns None."""
        assert validate_idempotency_key(None) is None
