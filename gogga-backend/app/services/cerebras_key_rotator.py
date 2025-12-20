"""
Cerebras API Key Rotator - Load balancing across multiple API keys.

Distributes requests across multiple Cerebras API keys to:
1. Avoid rate limits (30 req/min, 64k tokens/min per key)
2. Maximize throughput (6 keys = 180 req/min, 384k tokens/min)
3. Automatic failover when a key hits rate limits

Usage:
    rotator = get_key_rotator()
    key = rotator.get_next_key()
    # ... use key ...
    rotator.mark_rate_limited(key)  # If 429 received
"""
import logging
import time
from dataclasses import dataclass, field
from typing import Final

logger = logging.getLogger(__name__)

# Rate limit reset times (Cerebras uses rolling windows)
RATE_LIMIT_COOLDOWN_SECONDS: Final[int] = 65  # 1 minute + buffer


@dataclass
class KeyState:
    """Track state for a single API key."""
    key: str
    name: str
    request_count: int = 0
    last_used: float = 0.0
    rate_limited_until: float = 0.0
    consecutive_429s: int = 0
    
    @property
    def is_available(self) -> bool:
        """Check if key is available (not rate limited)."""
        return time.time() > self.rate_limited_until
    
    @property
    def cooldown_remaining(self) -> float:
        """Seconds until key is available again."""
        remaining = self.rate_limited_until - time.time()
        return max(0, remaining)


class CerebrasKeyRotator:
    """
    Round-robin load balancer for Cerebras API keys.
    
    Automatically rotates between available keys and handles rate limits
    by temporarily removing keys from the pool.
    """
    
    def __init__(self, keys: list[tuple[str, str]]):
        """
        Initialize with list of (api_key, name) tuples.
        
        Args:
            keys: List of (api_key, friendly_name) tuples
        """
        self._keys = [KeyState(key=k, name=n) for k, n in keys]
        self._current_index = 0
        self._total_requests = 0
        self._total_429s = 0
        
        logger.info(f"🔑 CerebrasKeyRotator initialized with {len(self._keys)} keys")
        for ks in self._keys:
            logger.info(f"   - {ks.name}: {ks.key[:12]}...{ks.key[-4:]}")
    
    def get_next_key(self) -> str:
        """
        Get the next available API key using round-robin.
        
        Skips rate-limited keys. If all keys are rate-limited,
        returns the one with shortest cooldown remaining.
        
        Returns:
            API key string
        """
        available = [ks for ks in self._keys if ks.is_available]
        
        if not available:
            # All keys rate limited - use the one with shortest cooldown
            soonest = min(self._keys, key=lambda ks: ks.cooldown_remaining)
            logger.warning(
                f"⚠️ All Cerebras keys rate-limited! Using {soonest.name} "
                f"(cooldown: {soonest.cooldown_remaining:.1f}s)"
            )
            return soonest.key
        
        # Round-robin through available keys
        for _ in range(len(self._keys)):
            ks = self._keys[self._current_index]
            self._current_index = (self._current_index + 1) % len(self._keys)
            
            if ks.is_available:
                ks.last_used = time.time()
                ks.request_count += 1
                self._total_requests += 1
                
                if self._total_requests % 10 == 0:
                    logger.debug(f"🔄 Using key: {ks.name} (req #{ks.request_count})")
                
                return ks.key
        
        # Fallback (shouldn't happen)
        return self._keys[0].key
    
    def mark_rate_limited(self, key: str, cooldown_seconds: int = RATE_LIMIT_COOLDOWN_SECONDS):
        """
        Mark a key as rate-limited after receiving 429.
        
        Args:
            key: The API key that was rate-limited
            cooldown_seconds: How long to wait before using again
        """
        for ks in self._keys:
            if ks.key == key:
                ks.rate_limited_until = time.time() + cooldown_seconds
                ks.consecutive_429s += 1
                self._total_429s += 1
                
                logger.warning(
                    f"🚫 Key {ks.name} rate-limited (429 #{ks.consecutive_429s}). "
                    f"Cooldown: {cooldown_seconds}s. Total 429s: {self._total_429s}"
                )
                return
        
        logger.warning(f"⚠️ Unknown key marked as rate-limited: {key[:12]}...")
    
    def mark_success(self, key: str):
        """Mark a key as successfully used (reset 429 counter)."""
        for ks in self._keys:
            if ks.key == key:
                ks.consecutive_429s = 0
                return
    
    def get_stats(self) -> dict:
        """Get current rotator statistics."""
        return {
            "total_keys": len(self._keys),
            "available_keys": sum(1 for ks in self._keys if ks.is_available),
            "total_requests": self._total_requests,
            "total_429s": self._total_429s,
            "keys": [
                {
                    "name": ks.name,
                    "key_preview": f"{ks.key[:8]}...{ks.key[-4:]}",
                    "requests": ks.request_count,
                    "is_available": ks.is_available,
                    "cooldown_remaining": round(ks.cooldown_remaining, 1),
                    "consecutive_429s": ks.consecutive_429s,
                    "last_used": ks.last_used,
                }
                for ks in self._keys
            ]
        }
    
    async def get_live_usage(self) -> dict:
        """
        Fetch live usage stats from Cerebras API for each key.
        Makes a minimal API call to get rate limit headers.
        """
        import httpx
        
        results = []
        async with httpx.AsyncClient(timeout=10.0) as client:
            for ks in self._keys:
                try:
                    resp = await client.post(
                        'https://api.cerebras.ai/v1/chat/completions',
                        headers={
                            'Authorization': f'Bearer {ks.key}',
                            'Content-Type': 'application/json'
                        },
                        json={
                            'model': 'qwen-3-32b',
                            'messages': [{'role': 'user', 'content': 'x'}],
                            'max_tokens': 1
                        }
                    )
                    
                    h = resp.headers
                    results.append({
                        "name": ks.name,
                        "key_preview": f"{ks.key[:8]}...{ks.key[-4:]}",
                        "status": "ok" if resp.status_code == 200 else f"error_{resp.status_code}",
                        "requests_remaining": {
                            "minute": int(h.get('x-ratelimit-remaining-requests-minute', 0)),
                            "hour": int(h.get('x-ratelimit-remaining-requests-hour', 0)),
                            "day": int(h.get('x-ratelimit-remaining-requests-day', 0)),
                        },
                        "tokens_remaining": {
                            "minute": int(h.get('x-ratelimit-remaining-tokens-minute', 0)),
                            "day": int(h.get('x-ratelimit-remaining-tokens-day', 0)),
                        },
                        "limits": {
                            "requests_per_minute": 30,
                            "requests_per_hour": 900,
                            "requests_per_day": 14400,
                            "tokens_per_minute": 64000,
                            "tokens_per_day": 1000000,
                        },
                        "session_requests": ks.request_count,
                        "session_429s": ks.consecutive_429s,
                        "is_available": ks.is_available,
                        "cooldown_remaining": round(ks.cooldown_remaining, 1),
                    })
                except Exception as e:
                    results.append({
                        "name": ks.name,
                        "key_preview": f"{ks.key[:8]}...{ks.key[-4:]}",
                        "status": f"error: {str(e)[:50]}",
                        "requests_remaining": None,
                        "tokens_remaining": None,
                        "is_available": ks.is_available,
                    })
        
        return {
            "timestamp": time.time(),
            "total_keys": len(self._keys),
            "available_keys": sum(1 for ks in self._keys if ks.is_available),
            "session_total_requests": self._total_requests,
            "session_total_429s": self._total_429s,
            "keys": results
        }


# Singleton instance
_rotator: CerebrasKeyRotator | None = None


def get_key_rotator() -> CerebrasKeyRotator:
    """
    Get or create the global key rotator instance.
    
    Keys are loaded from environment variable CEREBRAS_API_KEYS (comma-separated)
    or falls back to single CEREBRAS_API_KEY.
    """
    global _rotator
    
    if _rotator is None:
        import os
        from dotenv import load_dotenv
        from app.config import settings
        
        # Load .env file to get CEREBRAS_API_KEYS
        load_dotenv()
        
        # Try multi-key config first
        multi_keys = os.environ.get("CEREBRAS_API_KEYS", "")
        
        if multi_keys:
            # Format: "key1:name1,key2:name2,..."
            keys = []
            for entry in multi_keys.split(","):
                entry = entry.strip()
                if ":" in entry:
                    key, name = entry.split(":", 1)
                    keys.append((key.strip(), name.strip()))
                else:
                    keys.append((entry, f"key_{len(keys)+1}"))
            
            if keys:
                _rotator = CerebrasKeyRotator(keys)
                return _rotator
        
        # Fallback to single key from settings
        _rotator = CerebrasKeyRotator([(settings.CEREBRAS_API_KEY, "primary")])
    
    return _rotator


def reset_rotator():
    """Reset the global rotator (for testing)."""
    global _rotator
    _rotator = None
