"""
GOGGA Tool Result Cache Service

RECOMMENDATION #9: Cache tool results to reduce duplicate API calls.
- Redis-backed cache with 5-minute TTL
- Cache key based on tool name + arguments hash
- Async cache operations for non-blocking performance
"""

import hashlib
import json
import logging
from typing import Any, Optional
from datetime import timedelta

logger = logging.getLogger(__name__)


class ToolResultCache:
    """
    Cache for tool execution results.

    Reduces duplicate API calls for:
    - Web searches (same query within 5 minutes)
    - Math calculations (same operation, same data)
    - Chart data generation
    """

    def __init__(self, ttl_seconds: int = 300):
        """
        Initialize tool result cache.

        Args:
            ttl_seconds: Time-to-live for cached results (default: 5 minutes)
        """
        self.ttl_seconds = ttl_seconds
        self._redis = None
        self._cache_enabled = True

    def _get_redis(self):
        """Lazy load Redis client."""
        if self._redis is None:
            try:
                import redis.asyncio as redis
                self._redis = redis.from_url(
                    "redis://localhost:6379/0",
                    encoding="utf-8",
                    decode_responses=True
                )
                logger.info("[ToolCache] Redis client initialized")
            except ImportError:
                logger.warning("[ToolCache] Redis not available, cache disabled")
                self._cache_enabled = False
            except Exception as e:
                logger.warning(f"[ToolCache] Redis connection failed: {e}")
                self._cache_enabled = False

        return self._redis

    def _generate_cache_key(self, tool_name: str, arguments: dict[str, Any]) -> str:
        """
        Generate cache key from tool name and arguments.

        Args:
            tool_name: Name of the tool
            arguments: Tool arguments

        Returns:
            Cache key (SHA256 hash)
        """
        # Normalize arguments for consistent hashing
        normalized = json.dumps(arguments, sort_keys=True, default=str)
        key_string = f"tool:{tool_name}:{normalized}"

        return hashlib.sha256(key_string.encode()).hexdigest()[:32]

    async def get(self, tool_name: str, arguments: dict[str, Any]) -> Optional[Any]:
        """
        Get cached tool result.

        Args:
            tool_name: Name of the tool
            arguments: Tool arguments

        Returns:
            Cached result if found and not expired, None otherwise
        """
        if not self._cache_enabled:
            return None

        try:
            redis = self._get_redis()
            if redis is None:
                return None

            cache_key = self._generate_cache_key(tool_name, arguments)
            cached = await redis.get(cache_key)

            if cached:
                logger.debug(f"[ToolCache] HIT: {tool_name} (key: {cache_key[:16]}...)")
                return json.loads(cached)
            else:
                logger.debug(f"[ToolCache] MISS: {tool_name} (key: {cache_key[:16]}...)")
                return None

        except Exception as e:
            logger.error(f"[ToolCache] Get failed: {e}")
            return None

    async def set(
        self,
        tool_name: str,
        arguments: dict[str, Any],
        result: Any
    ) -> bool:
        """
        Cache tool result.

        Args:
            tool_name: Name of the tool
            arguments: Tool arguments
            result: Result to cache

        Returns:
            True if cached successfully, False otherwise
        """
        if not self._cache_enabled:
            return False

        try:
            redis = self._get_redis()
            if redis is None:
                return False

            cache_key = self._generate_cache_key(tool_name, arguments)
            value = json.dumps(result, default=str)

            await redis.setex(
                cache_key,
                self.ttl_seconds,
                value
            )

            logger.debug(
                f"[ToolCache] SET: {tool_name} (key: {cache_key[:16]}..., TTL: {self.ttl_seconds}s)"
            )
            return True

        except Exception as e:
            logger.error(f"[ToolCache] Set failed: {e}")
            return False

    async def delete(self, tool_name: str, arguments: dict[str, Any]) -> bool:
        """
        Delete cached tool result.

        Args:
            tool_name: Name of the tool
            arguments: Tool arguments

        Returns:
            True if deleted successfully, False otherwise
        """
        if not self._cache_enabled:
            return False

        try:
            redis = self._get_redis()
            if redis is None:
                return False

            cache_key = self._generate_cache_key(tool_name, arguments)
            await redis.delete(cache_key)

            logger.debug(f"[ToolCache] DELETE: {tool_name} (key: {cache_key[:16]}...)")
            return True

        except Exception as e:
            logger.error(f"[ToolCache] Delete failed: {e}")
            return False

    async def clear_all(self) -> bool:
        """
        Clear all cached tool results.

        Returns:
            True if cleared successfully, False otherwise
        """
        if not self._cache_enabled:
            return False

        try:
            redis = self._get_redis()
            if redis is None:
                return False

            # Find all keys matching "tool:*" pattern
            keys = []
            async for key in redis.scan_iter("tool:*"):
                keys.append(key)

            if keys:
                await redis.delete(*keys)
                logger.info(f"[ToolCache] Cleared {len(keys)} cached results")

            return True

        except Exception as e:
            logger.error(f"[ToolCache] Clear all failed: {e}")
            return False

    async def get_stats(self) -> dict[str, Any]:
        """
        Get cache statistics.

        Returns:
            Dict with cache stats (keys, memory usage, hit rate)
        """
        if not self._cache_enabled:
            return {"enabled": False}

        try:
            redis = self._get_redis()
            if redis is None:
                return {"enabled": False}

            # Count tool cache keys
            key_count = 0
            async for key in redis.scan_iter("tool:*"):
                key_count += 1

            return {
                "enabled": True,
                "ttl_seconds": self.ttl_seconds,
                "key_count": key_count,
            }

        except Exception as e:
            logger.error(f"[ToolCache] Get stats failed: {e}")
            return {"enabled": False, "error": str(e)}

    def enable(self):
        """Enable caching."""
        self._cache_enabled = True
        logger.info("[ToolCache] Enabled")

    def disable(self):
        """Disable caching."""
        self._cache_enabled = False
        logger.info("[ToolCache] Disabled")


# Singleton instance
_tool_cache: Optional[ToolResultCache] = None


def get_tool_result_cache() -> ToolResultCache:
    """Get the global tool result cache instance."""
    global _tool_cache
    if _tool_cache is None:
        _tool_cache = ToolResultCache(ttl_seconds=300)  # 5 minutes
    return _tool_cache


async def cached_tool_call(
    tool_name: str,
    arguments: dict[str, Any],
    execute_func: callable
) -> Any:
    """
    Execute tool with caching.

    Usage:
        result = await cached_tool_call(
            "web_search",
            {"query": "Python tutorials", "num_results": 5},
            lambda: execute_web_search(**arguments)
        )

    Args:
        tool_name: Name of the tool
        arguments: Tool arguments
        execute_func: Async function to execute if cache miss

    Returns:
        Tool result (from cache or freshly executed)
    """
    cache = get_tool_result_cache()

    # Try cache first
    cached_result = await cache.get(tool_name, arguments)
    if cached_result is not None:
        return cached_result

    # Cache miss - execute tool
    result = await execute_func()

    # Cache the result
    await cache.set(tool_name, arguments, result)

    return result
