"""
OpenRouter Service for FREE Tier Operations.

Handles:
1. Text Chat (FREE tier) - Llama 3.3 70B FREE
2. Prompt Enhancement (ALL tiers) - Llama 3.3 70B FREE  
3. Image Generation (FREE tier) - LongCat Flash FREE

This is completely separate from Cerebras (JIVE/JIGGA text) and DeepInfra (JIVE/JIGGA images).
"""

import httpx
import logging
import time
from typing import Any

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# OpenRouter API endpoint
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"


class OpenRouterService:
    """
    OpenRouter integration for FREE tier and universal prompt enhancement.
    
    Text (FREE tier):
        User → Llama 3.3 70B FREE → Response
        
    Prompt Enhancement (ALL tiers):
        User prompt → Llama 3.3 70B FREE → Enhanced prompt
        
    Image (FREE tier):
        User → Llama 3.3 70B (enhance) → LongCat Flash → Image
    """
    
    def __init__(self):
        self.api_key = settings.OPENROUTER_API_KEY
        self.model_llama = settings.OPENROUTER_MODEL_LLAMA
        self.model_longcat = settings.OPENROUTER_MODEL_LONGCAT
        self._client: httpx.AsyncClient | None = None
    
    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create async HTTP client."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=OPENROUTER_BASE_URL,
                timeout=120.0,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": settings.APP_URL,
                    "X-Title": "Gogga AI"
                }
            )
        return self._client
    
    async def close(self) -> None:
        """Close the HTTP client."""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None
    
    async def _chat_completion(
        self,
        model: str,
        messages: list[dict[str, str]],
        max_tokens: int = 2048,
        temperature: float = 0.7
    ) -> dict[str, Any]:
        """
        Make a chat completion request to OpenRouter.
        
        Returns full response with content and usage.
        """
        client = await self._get_client()
        start = time.perf_counter()
        
        response = await client.post(
            "/chat/completions",
            json={
                "model": model,
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature
            }
        )
        response.raise_for_status()
        data = response.json()
        latency = time.perf_counter() - start
        
        content = data["choices"][0]["message"]["content"]
        usage = data.get("usage", {})
        
        return {
            "content": content,
            "usage": usage,
            "latency_seconds": round(latency, 3),
            "model": model
        }
    
    # =========================================================================
    # TEXT CHAT (FREE TIER)
    # =========================================================================
    
    async def chat_free(
        self,
        message: str,
        system_prompt: str,
        history: list[dict[str, str]] | None = None,
        user_id: str | None = None
    ) -> dict[str, Any]:
        """
        FREE tier text chat using Llama 3.3 70B.
        
        Args:
            message: User's input message
            system_prompt: System prompt for context
            history: Optional conversation history
            user_id: Optional user identifier
            
        Returns:
            Dict with response, meta, and usage
        """
        messages = [{"role": "system", "content": system_prompt}]
        
        if history:
            messages.extend(history[-10:])  # Last 10 messages
        
        messages.append({"role": "user", "content": message})
        
        logger.info(
            "FREE chat | user=%s | prompt=%s",
            user_id or "anonymous",
            message[:50] + "..." if len(message) > 50 else message
        )
        
        result = await self._chat_completion(
            model=self.model_llama,
            messages=messages,
            max_tokens=2048,
            temperature=0.7
        )
        
        logger.info(
            "FREE chat complete | latency=%.2fs | tokens=%d/%d",
            result["latency_seconds"],
            result["usage"].get("prompt_tokens", 0),
            result["usage"].get("completion_tokens", 0)
        )
        
        return {
            "response": result["content"],
            "meta": {
                "tier": "free",
                "layer": "free_text",
                "model": self.model_llama,
                "provider": "openrouter",
                "latency_seconds": result["latency_seconds"],
                "tokens": {
                    "input": result["usage"].get("prompt_tokens", 0),
                    "output": result["usage"].get("completion_tokens", 0)
                },
                "cost": 0.0  # FREE tier
            }
        }
    
    # =========================================================================
    # PROMPT ENHANCEMENT (ALL TIERS)
    # =========================================================================
    
    async def enhance_prompt(self, user_prompt: str) -> dict[str, Any]:
        """
        Universal prompt enhancement using Llama 3.3 70B FREE.
        
        Available to ALL tiers via the "Enhance" button.
        Works for both image and text prompts.
        
        Args:
            user_prompt: Raw user input
            
        Returns:
            Dict with original and enhanced prompts
        """
        start = time.perf_counter()
        
        messages = [
            {
                "role": "system",
                "content": """You are an expert prompt engineer. Your task is to enhance user prompts for better AI responses.

For IMAGE prompts:
- Add style, lighting, composition, mood
- Specify art style if not mentioned
- Add camera angles and perspectives
- Keep under 100 words

For TEXT prompts:
- Add context and specificity
- Clarify intent
- Add relevant constraints
- Keep the original intent

Output ONLY the enhanced prompt, no explanations."""
            },
            {
                "role": "user",
                "content": f"Enhance this prompt: {user_prompt}"
            }
        ]
        
        result = await self._chat_completion(
            model=self.model_llama,
            messages=messages,
            max_tokens=500,
            temperature=0.7
        )
        
        total_latency = time.perf_counter() - start
        
        logger.info(
            "Prompt enhanced | original=%d chars | enhanced=%d chars | latency=%.2fs",
            len(user_prompt), len(result["content"]), total_latency
        )
        
        return {
            "original_prompt": user_prompt,
            "enhanced_prompt": result["content"].strip(),
            "meta": {
                "model": self.model_llama,
                "provider": "openrouter",
                "latency_seconds": round(total_latency, 3),
                "cost": 0.0  # FREE
            }
        }
    
    # =========================================================================
    # IMAGE GENERATION (FREE TIER)
    # =========================================================================
    
    async def generate_image_free(
        self,
        prompt: str,
        user_id: str | None = None,
        enhance: bool = True
    ) -> dict[str, Any]:
        """
        FREE tier image generation: Llama 3.3 → LongCat Flash.
        
        Pipeline:
        1. Enhance prompt with Llama 3.3 70B (if enabled)
        2. Generate image with LongCat Flash
        
        Args:
            prompt: Image description
            user_id: Optional user identifier
            enhance: Whether to enhance prompt first
            
        Returns:
            Dict with image data and metadata
        """
        start = time.perf_counter()
        original_prompt = prompt
        enhancement_meta = {}
        
        # Step 1: Enhance prompt (optional)
        if enhance:
            try:
                enhancement = await self.enhance_prompt(prompt)
                prompt = enhancement["enhanced_prompt"]
                enhancement_meta = enhancement["meta"]
            except Exception as e:
                logger.warning("Prompt enhancement failed: %s", e)
                enhancement_meta = {"error": str(e)}
        
        # Step 2: Generate with LongCat
        logger.info(
            "FREE image | user=%s | prompt=%s",
            user_id or "anonymous",
            prompt[:50] + "..." if len(prompt) > 50 else prompt
        )
        
        messages = [
            {
                "role": "user",
                "content": prompt
            }
        ]
        
        client = await self._get_client()
        response = await client.post(
            "/chat/completions",
            json={
                "model": self.model_longcat,
                "messages": messages,
                "max_tokens": 4096,
            }
        )
        response.raise_for_status()
        data = response.json()
        
        total_latency = time.perf_counter() - start
        content = data["choices"][0]["message"]["content"]
        
        logger.info(
            "FREE image complete | user=%s | latency=%.2fs",
            user_id or "anonymous",
            total_latency
        )
        
        return {
            "original_prompt": original_prompt,
            "enhanced_prompt": prompt,
            "content": content,  # LongCat returns image description/data
            "meta": {
                "tier": "free",
                "pipeline": "llama-longcat",
                "enhancement": enhancement_meta,
                "generation_model": self.model_longcat,
                "latency_seconds": round(total_latency, 3),
                "cost": 0.0  # FREE
            }
        }
    
    # =========================================================================
    # HEALTH CHECK
    # =========================================================================
    
    async def health_check(self) -> dict[str, Any]:
        """Check OpenRouter API health."""
        try:
            client = await self._get_client()
            start = time.perf_counter()
            
            response = await client.get("/models", timeout=5.0)
            latency = time.perf_counter() - start
            
            if response.status_code == 200:
                return {
                    "status": "healthy",
                    "provider": "openrouter",
                    "latency_ms": round(latency * 1000, 2),
                    "models": {
                        "text": self.model_llama,
                        "image": self.model_longcat
                    }
                }
        except Exception as e:
            logger.debug("OpenRouter health check: %s", e)
        
        return {"status": "unavailable", "provider": "openrouter"}


# Singleton instance
openrouter_service = OpenRouterService()
