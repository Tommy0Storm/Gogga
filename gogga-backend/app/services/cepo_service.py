"""
GOGGA CePO Service - Cerebras Planning and Optimization Integration

This service provides a failsafe wrapper around the CePO sidecar container.
It routes JIVE/JIGGA requests through CePO for enhanced reasoning, with
automatic fallback to direct Cerebras API calls on failure.

CePO Pipeline:
1. Plan Generation → 2. Initial Solution → 3. Plan Refinement → 4. Final Solution
Then Best of N selection picks the optimal response.

Expected improvement: +10-20% accuracy on reasoning tasks (per OptiLLM benchmarks)
"""
import asyncio
import logging
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Final

import httpx

from app.config import Settings

logger = logging.getLogger(__name__)

# CePO configuration
CEPO_BASE_URL: Final[str] = "http://cepo:8080"
CEPO_TIMEOUT: Final[float] = 120.0  # CePO can take longer due to multi-pass
CEPO_HEALTH_CHECK_INTERVAL: Final[float] = 30.0
DIRECT_CEREBRAS_URL: Final[str] = "https://api.cerebras.ai/v1"


class CePoStatus(str, Enum):
    """CePO service health status."""
    HEALTHY = "healthy"
    DEGRADED = "degraded"  # Some requests failing
    UNAVAILABLE = "unavailable"


@dataclass
class CePoConfig:
    """CePO request configuration."""
    # Best of N settings
    bestofn_n: int = 3
    bestofn_temperature: float = 0.1
    bestofn_rating_type: str = "absolute"  # absolute, pairwise, majority_voting
    
    # Planning settings
    planning_n: int = 3
    planning_m: int = 6
    
    # Token limits
    max_tokens: int = 4096
    
    # Timeout and retries
    timeout_seconds: float = 120.0
    max_retries: int = 2


@dataclass
class CePoMetrics:
    """Metrics for CePO service performance."""
    total_requests: int = 0
    successful_requests: int = 0
    fallback_requests: int = 0
    average_latency_ms: float = 0.0
    last_health_check: float = 0.0
    status: CePoStatus = CePoStatus.UNAVAILABLE
    
    @property
    def success_rate(self) -> float:
        if self.total_requests == 0:
            return 0.0
        return self.successful_requests / self.total_requests
    
    @property
    def fallback_rate(self) -> float:
        if self.total_requests == 0:
            return 0.0
        return self.fallback_requests / self.total_requests


class CePoService:
    """
    Service for routing requests through CePO with automatic failsafe.
    
    This service:
    1. Routes JIVE/JIGGA requests to CePO container for enhanced reasoning
    2. Falls back to direct Cerebras API on CePO failure
    3. Tracks metrics for monitoring
    4. Performs periodic health checks
    """
    
    _instance: "CePoService | None" = None
    _client: httpx.AsyncClient | None = None
    _fallback_client: httpx.AsyncClient | None = None
    
    def __new__(cls) -> "CePoService":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self) -> None:
        if self._initialized:
            return
        self._initialized = True
        self._metrics = CePoMetrics()
        self._health_check_task: asyncio.Task | None = None
        self._settings = Settings()
        logger.info("CePoService initialized with failsafe to direct Cerebras API")
    
    async def _get_cepo_client(self) -> httpx.AsyncClient:
        """Get or create the CePO HTTP client."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=CEPO_BASE_URL,
                timeout=httpx.Timeout(CEPO_TIMEOUT),
                headers={"Content-Type": "application/json"},
            )
        return self._client
    
    async def _get_fallback_client(self) -> httpx.AsyncClient:
        """Get or create the fallback Cerebras HTTP client."""
        if self._fallback_client is None or self._fallback_client.is_closed:
            self._fallback_client = httpx.AsyncClient(
                base_url=DIRECT_CEREBRAS_URL,
                timeout=httpx.Timeout(60.0),
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {self._settings.CEREBRAS_API_KEY}",
                },
            )
        return self._fallback_client
    
    async def check_health(self) -> bool:
        """Check if CePO container is healthy."""
        try:
            client = await self._get_cepo_client()
            response = await client.get("/health", timeout=5.0)
            is_healthy = response.status_code == 200
            self._metrics.status = CePoStatus.HEALTHY if is_healthy else CePoStatus.UNAVAILABLE
            self._metrics.last_health_check = time.time()
            return is_healthy
        except Exception as e:
            logger.warning(f"CePO health check failed: {e}")
            self._metrics.status = CePoStatus.UNAVAILABLE
            return False
    
    async def start_health_monitoring(self) -> None:
        """Start background health check task."""
        if self._health_check_task is None or self._health_check_task.done():
            self._health_check_task = asyncio.create_task(self._health_check_loop())
            logger.info("Started CePO health monitoring")
    
    async def _health_check_loop(self) -> None:
        """Periodic health check loop."""
        while True:
            try:
                await self.check_health()
                await asyncio.sleep(CEPO_HEALTH_CHECK_INTERVAL)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Health check loop error: {e}")
                await asyncio.sleep(CEPO_HEALTH_CHECK_INTERVAL)
    
    async def generate_with_cepo(
        self,
        model: str,
        messages: list[dict[str, str]],
        temperature: float = 0.6,
        max_tokens: int = 4096,
        config: CePoConfig | None = None,
    ) -> dict[str, Any]:
        """
        Generate completion using CePO with automatic failsafe.
        
        Args:
            model: Model ID (e.g., 'qwen-3-32b')
            messages: Chat messages in OpenAI format
            temperature: Base temperature (CePO uses internal settings per step)
            max_tokens: Maximum output tokens
            config: Optional CePO configuration override
            
        Returns:
            OpenAI-compatible completion response
        """
        config = config or CePoConfig()
        self._metrics.total_requests += 1
        start_time = time.perf_counter()
        
        # Try CePO first
        try:
            # Only skip if we've verified unhealthy recently (within last 60s)
            if (self._metrics.status == CePoStatus.UNAVAILABLE and 
                self._metrics.last_health_check > 0 and
                time.time() - self._metrics.last_health_check < 60):
                # Skip CePO if recently verified unhealthy
                raise ConnectionError("CePO recently unavailable, using fallback")
            
            response = await self._call_cepo(model, messages, temperature, max_tokens, config)
            
            # Update metrics on success
            latency_ms = (time.perf_counter() - start_time) * 1000
            self._update_latency(latency_ms)
            self._metrics.successful_requests += 1
            
            logger.info(f"CePO request successful: {latency_ms:.0f}ms, model={model}")
            return response
            
        except Exception as e:
            logger.warning(f"CePO failed, falling back to direct Cerebras: {e}")
            self._metrics.fallback_requests += 1
            
            # Fallback to direct Cerebras API
            return await self._call_cerebras_direct(model, messages, temperature, max_tokens)
    
    async def _call_cepo(
        self,
        model: str,
        messages: list[dict[str, str]],
        temperature: float,
        max_tokens: int,
        config: CePoConfig,
    ) -> dict[str, Any]:
        """Call the CePO sidecar container."""
        client = await self._get_cepo_client()
        
        # CePO expects OpenAI-compatible format with cepo_ prefix for config
        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            # CePO-specific parameters via extra_body
            "extra_body": {
                "optillm_approach": "cepo",
                "cepo_bestofn_n": config.bestofn_n,
                "cepo_bestofn_temperature": config.bestofn_temperature,
                "cepo_bestofn_rating_type": config.bestofn_rating_type,
                "cepo_planning_n": config.planning_n,
                "cepo_planning_m": config.planning_m,
            }
        }
        
        response = await client.post(
            "/v1/chat/completions",
            json=payload,
            timeout=config.timeout_seconds,
        )
        response.raise_for_status()
        return response.json()
    
    async def _call_cerebras_direct(
        self,
        model: str,
        messages: list[dict[str, str]],
        temperature: float,
        max_tokens: int,
    ) -> dict[str, Any]:
        """Fallback: Call Cerebras API directly without CePO."""
        client = await self._get_fallback_client()
        
        # Apply OptiLLM enhancements locally (from optillm_enhancements.py)
        # This provides basic CoT/planning even without CePO
        from app.services.optillm_enhancements import (
            get_enhancement_config,
            enhance_system_prompt,
            enhance_user_message,
            EnhancementLevel,
        )
        
        # Get tier from model (infer from model name)
        tier = "jigga" if "235b" in model.lower() else "jive"
        enhancement_config = get_enhancement_config(tier=tier, is_complex=True)
        
        # Apply enhancements to system prompt
        enhanced_messages = []
        for msg in messages:
            if msg["role"] == "system":
                enhanced_content = enhance_system_prompt(msg["content"], enhancement_config)
                enhanced_messages.append({"role": "system", "content": enhanced_content})
            elif msg["role"] == "user" and len(msg["content"]) > 50:
                enhanced_content = enhance_user_message(msg["content"], enhancement_config)
                enhanced_messages.append({"role": "user", "content": enhanced_content})
            else:
                enhanced_messages.append(msg)
        
        payload = {
            "model": model,
            "messages": enhanced_messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "top_p": 0.95,
        }
        
        response = await client.post("/chat/completions", json=payload)
        response.raise_for_status()
        
        logger.info(f"Fallback to direct Cerebras API successful: model={model}")
        return response.json()
    
    def _update_latency(self, latency_ms: float) -> None:
        """Update rolling average latency."""
        if self._metrics.average_latency_ms == 0:
            self._metrics.average_latency_ms = latency_ms
        else:
            # Exponential moving average with alpha=0.1
            self._metrics.average_latency_ms = (
                0.9 * self._metrics.average_latency_ms + 0.1 * latency_ms
            )
    
    def get_metrics(self) -> dict[str, Any]:
        """Get current CePO service metrics."""
        return {
            "status": self._metrics.status.value,
            "total_requests": self._metrics.total_requests,
            "successful_requests": self._metrics.successful_requests,
            "fallback_requests": self._metrics.fallback_requests,
            "success_rate": round(self._metrics.success_rate, 3),
            "fallback_rate": round(self._metrics.fallback_rate, 3),
            "average_latency_ms": round(self._metrics.average_latency_ms, 1),
            "last_health_check": self._metrics.last_health_check,
        }
    
    async def close(self) -> None:
        """Clean up resources."""
        if self._health_check_task:
            self._health_check_task.cancel()
            try:
                await self._health_check_task
            except asyncio.CancelledError:
                pass
        
        if self._client:
            await self._client.aclose()
            self._client = None
        
        if self._fallback_client:
            await self._fallback_client.aclose()
            self._fallback_client = None
        
        logger.info("CePoService closed")


# Singleton accessor
def get_cepo_service() -> CePoService:
    """Get the CePO service singleton."""
    return CePoService()
