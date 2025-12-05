"""
GOGGA CePO Service
Cerebras Planning Optimization via OptiLLM sidecar container.

CePO enables advanced reasoning through iterative chain-of-thought planning:
- Multi-step planning and reasoning
- Self-correction and refinement
- Enhanced performance on complex legal/coding tasks

The CePO server runs as a Docker sidecar container (see docker-compose.yml).
"""
import logging
import time
from typing import Any, Final

import httpx

from app.config import settings


logger = logging.getLogger(__name__)

# CePO Configuration - connects to Docker sidecar or local OptiLLM
CEPO_TIMEOUT: Final[float] = 120.0  # CePO can take longer for complex reasoning

# CePO uses Llama 3.3 70B for JIVE tier reasoning
# ~2,200 tokens/s on Cerebras - excellent for complex reasoning
CEPO_MODEL: Final[str] = "llama3.3-70b"  # JIVE tier model


class CepoService:
    """
    CePO (Cerebras Planning Optimization) Service.
    
    Connects to an OptiLLM sidecar container for advanced reasoning:
    - Iterative refinement of responses
    - Planning-based reasoning for legal/coding tasks
    - Self-evaluation and correction
    
    The sidecar is defined in docker-compose.yml and runs OptiLLM
    with the --approach cepo flag.
    """
    
    def __init__(self, base_url: str | None = None):
        self.base_url = (base_url or settings.CEPO_URL).rstrip("/")
        self.enabled = settings.CEPO_ENABLED
        self._client: httpx.AsyncClient | None = None
    
    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create async HTTP client."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                timeout=CEPO_TIMEOUT,
                headers={"Content-Type": "application/json"}
            )
        return self._client
    
    async def close(self) -> None:
        """Close the HTTP client."""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None
    
    async def health_check(self) -> dict[str, Any]:
        """Check CePO sidecar health."""
        try:
            client = await self._get_client()
            start = time.perf_counter()
            response = await client.get("/health", timeout=5.0)
            latency = time.perf_counter() - start
            
            if response.status_code == 200:
                return {
                    "status": "healthy",
                    "approach": "cepo",
                    "latency_ms": round(latency * 1000, 2)
                }
        except Exception as e:
            logger.debug("CePO health check: %s", e)
        
        return {"status": "unavailable", "approach": "cepo"}
    
    async def is_available(self) -> bool:
        """Check if CePO sidecar is available and enabled."""
        if not self.enabled:
            return False
        health = await self.health_check()
        return health["status"] == "healthy"
    
    async def generate_with_cepo(
        self,
        message: str,
        system_prompt: str,
        history: list[dict[str, str]] | None = None,
        model: str | None = None,
        mode: str = "fast",
        max_tokens: int = 4096
    ) -> dict[str, Any]:
        """
        Generate a response using CePO optimization.
        
        CePO provides enhanced reasoning through iterative refinement,
        ideal for:
        - Legal analysis requiring careful reasoning
        - Complex coding problems
        - Multi-step problem solving
        
        Args:
            message: User's input message
            system_prompt: System prompt for context
            history: Optional conversation history
            model: Model to use (overrides mode if provided)
            mode: "fast" for Llama 3.3 70B, "deep" for Qwen 3 235B
            max_tokens: Max output tokens (default: 4096, extended: 8000)
            
        Returns:
            Dict containing response and metadata
        """
        # Check availability first
        if not await self.is_available():
            logger.info("CePO unavailable, using fallback")
            return await self._fallback_generate(message, system_prompt, history, model)
        
        start_time = time.perf_counter()
        
        # Build messages
        messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]
        if history:
            messages.extend(history[-5:])
        messages.append({"role": "user", "content": message})
        
        # Use explicit model or default to Llama 3.3 70B
        model_id = model if model else CEPO_MODEL
        
        try:
            client = await self._get_client()
            response = await client.post(
                "/v1/chat/completions",
                json={
                    "model": model_id,
                    "messages": messages,
                    "temperature": 0.7,
                    "max_tokens": max_tokens,
                }
            )
            response.raise_for_status()
            data = response.json()
            
            latency = time.perf_counter() - start_time
            content = data["choices"][0]["message"]["content"]
            usage = data.get("usage", {})
            
            # OptiLLM/CePO doesn't return prompt_tokens, so estimate from messages
            # Approximation: ~4 chars per token for English text
            prompt_tokens = usage.get("prompt_tokens")
            if prompt_tokens is None or prompt_tokens == 0:
                total_chars = sum(len(m.get("content", "")) for m in messages)
                prompt_tokens = max(1, total_chars // 4)
            
            completion_tokens = usage.get("completion_tokens", 0)
            
            logger.info(
                "CePO complete | model=%s | latency=%.2fs | tokens=%d/%d",
                model_id, latency, prompt_tokens, completion_tokens
            )
            
            return {
                "response": content,
                "meta": {
                    "model_used": model_id,
                    "layer": "reasoning",
                    "approach": "cepo",
                    "mode": "deep",  # All JIVE reasoning uses deep mode
                    "latency_seconds": round(latency, 3),
                    "tokens": {
                        "input": prompt_tokens,
                        "output": completion_tokens
                    }
                }
            }
            
        except Exception as e:
            logger.warning("CePO failed, using fallback: %s", e)
            return await self._fallback_generate(message, system_prompt, history, model)
    
    async def _fallback_generate(
        self,
        message: str,
        system_prompt: str,
        history: list[dict[str, str]] | None,
        model: str | None
    ) -> dict[str, Any]:
        """Fallback to direct Cerebras API when CePO unavailable."""
        from app.services.ai_service import ai_service
        from app.core.router import CognitiveLayer
        
        return await ai_service.generate_response(
            user_id="cepo_fallback",
            message=message,
            history=history,
            force_layer=CognitiveLayer.COMPLEX
        )


# Singleton instance
cepo_service = CepoService()
