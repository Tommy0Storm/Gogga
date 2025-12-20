"""
Idempotency key handling for GOGGA media generation.

Prevents duplicate API calls and cost when requests are retried.
Uses in-memory cache with TTL for key deduplication.

Design:
- Client sends UUID as idempotency_key in request body
- Server caches (key -> response) for TTL period
- Duplicate requests within TTL return cached response
- Keys expire after TTL to prevent memory bloat
"""

import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Generic, TypeVar

logger = logging.getLogger(__name__)

T = TypeVar("T")


@dataclass
class CachedResponse(Generic[T]):
    """Cached response with expiry timestamp."""
    response: T
    expires_at: float
    created_at: float = field(default_factory=time.time)
    
    @property
    def is_expired(self) -> bool:
        return time.time() > self.expires_at


class IdempotencyCache:
    """
    In-memory cache for idempotency key deduplication.
    
    For production at scale, replace with Redis.
    """
    
    def __init__(
        self,
        ttl_seconds: float = 3600.0,  # 1 hour default
        max_size: int = 10000,        # Maximum cached entries
        cleanup_interval: float = 300.0,  # 5 minutes
    ) -> None:
        self.ttl_seconds = ttl_seconds
        self.max_size = max_size
        self.cleanup_interval = cleanup_interval
        
        self._cache: dict[str, CachedResponse[Any]] = {}
        self._lock = asyncio.Lock()
        self._last_cleanup = time.time()
    
    async def get(self, key: str) -> Any | None:
        """
        Get cached response for idempotency key.
        
        Returns None if key not found or expired.
        """
        async with self._lock:
            cached = self._cache.get(key)
            if cached is None:
                return None
            
            if cached.is_expired:
                del self._cache[key]
                return None
            
            logger.info("Idempotency cache HIT for key: %s", key[:8])
            return cached.response
    
    async def set(self, key: str, response: Any) -> None:
        """
        Cache response for idempotency key.
        
        Triggers cleanup if interval elapsed.
        """
        async with self._lock:
            # Check if cleanup needed
            if time.time() - self._last_cleanup > self.cleanup_interval:
                await self._cleanup_expired()
            
            # Evict oldest if at capacity
            if len(self._cache) >= self.max_size:
                await self._evict_oldest()
            
            self._cache[key] = CachedResponse(
                response=response,
                expires_at=time.time() + self.ttl_seconds,
            )
            logger.info("Idempotency cache SET for key: %s", key[:8])
    
    async def exists(self, key: str) -> bool:
        """Check if key exists and is not expired."""
        return await self.get(key) is not None
    
    async def _cleanup_expired(self) -> None:
        """Remove all expired entries (call within lock)."""
        now = time.time()
        expired_keys = [
            k for k, v in self._cache.items()
            if v.is_expired
        ]
        for key in expired_keys:
            del self._cache[key]
        
        self._last_cleanup = now
        if expired_keys:
            logger.info("Idempotency cache cleaned %d expired entries", len(expired_keys))
    
    async def _evict_oldest(self) -> None:
        """Remove oldest 10% of entries (call within lock)."""
        if not self._cache:
            return
        
        sorted_keys = sorted(
            self._cache.keys(),
            key=lambda k: self._cache[k].created_at,
        )
        evict_count = max(1, len(sorted_keys) // 10)
        for key in sorted_keys[:evict_count]:
            del self._cache[key]
        
        logger.info("Idempotency cache evicted %d oldest entries", evict_count)
    
    @property
    def size(self) -> int:
        """Current cache size."""
        return len(self._cache)


# Singleton caches for different services
imagen_idempotency = IdempotencyCache(ttl_seconds=3600)  # 1 hour for images
veo_idempotency = IdempotencyCache(ttl_seconds=7200)     # 2 hours for videos (longer jobs)


def validate_idempotency_key(key: str | None) -> str | None:
    """
    Validate idempotency key format (UUID v4).
    
    Returns key if valid, None otherwise.
    """
    if key is None:
        return None
    
    import re
    uuid_pattern = r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
    if re.match(uuid_pattern, key.lower()):
        return key.lower()
    
    logger.warning("Invalid idempotency key format: %s", key[:20] if key else "None")
    return None
