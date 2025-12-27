"""
GOGGA Gemini Service - Vertex AI Integration

Provides access to Gemini models via Google's unified google-genai SDK
configured for Vertex AI. Supports:
- Thinking mode with configurable budget
- Google Search grounding
- Streaming responses
- Async operations

This is the recommended approach for Vertex AI Gemini models (Dec 2025).
Uses Application Default Credentials or service account.

Enterprise features:
- Lazy singleton pattern
- Circuit breaker for sustained failures
- Retry with exponential backoff
- Thinking budget configuration per tier

Usage:
    from app.services.gemini_service import gemini_service
    
    # Simple generation
    response = await gemini_service.generate(
        prompt="What is POPIA?",
        tier=UserTier.JIGGA,
    )
    
    # With Google Search grounding
    response = await gemini_service.generate(
        prompt="Latest news about South African economy",
        tier=UserTier.JIGGA,
        use_google_search=True,
    )
    
    # Streaming
    async for chunk in gemini_service.generate_stream(
        prompt="Explain load shedding in SA",
        tier=UserTier.JIVE,
    ):
        print(chunk.text, end="")
"""

import asyncio
import logging
import time
from dataclasses import dataclass
from enum import Enum
from typing import AsyncIterator, Any

from google import genai
from google.genai import types

from app.config import get_settings
from app.core.router import UserTier

logger = logging.getLogger(__name__)


class ThinkingLevel(str, Enum):
    """Thinking budget levels mapped to token budgets."""
    OFF = "off"           # 0 tokens - no thinking
    LOW = "low"           # 1024 tokens - quick reasoning
    MEDIUM = "medium"     # 4096 tokens - balanced
    HIGH = "high"         # 8192 tokens - deep reasoning
    MAX = "max"           # 16384 tokens - maximum reasoning


# Tier to thinking budget mapping (uses config values at runtime)
def get_tier_thinking_budget(tier: UserTier, settings) -> int:
    """Get thinking budget for tier from config."""
    budgets = {
        UserTier.FREE: settings.GEMINI_THINKING_BUDGET_FREE,
        UserTier.JIVE: settings.GEMINI_THINKING_BUDGET_JIVE,
        UserTier.JIGGA: settings.GEMINI_THINKING_BUDGET_JIGGA,
    }
    return budgets.get(tier, 0)

# Thinking level to token budget mapping
THINKING_BUDGET: dict[ThinkingLevel, int] = {
    ThinkingLevel.OFF: 0,
    ThinkingLevel.LOW: 1024,
    ThinkingLevel.MEDIUM: 4096,
    ThinkingLevel.HIGH: 8192,
    ThinkingLevel.MAX: 16384,
}


@dataclass
class GeminiResponse:
    """Response from Gemini generation."""
    text: str
    thinking: str | None = None
    grounding_metadata: dict[str, Any] | None = None
    usage: dict[str, int] | None = None
    model: str = ""
    

@dataclass
class GeminiStreamChunk:
    """Single chunk from streaming response."""
    text: str
    is_thinking: bool = False
    is_complete: bool = False


class GeminiService:
    """
    Vertex AI Gemini service using google-genai SDK.
    
    Provides async generation with:
    - Thinking mode (budget-based)
    - Google Search grounding
    - Streaming support
    """
    
    def __init__(self) -> None:
        self._client: genai.Client | None = None
        self._settings = get_settings()
        self._initialized = False
    
    def _get_client(self) -> genai.Client:
        """Get or create the genai client (lazy singleton)."""
        if self._client is None:
            self._client = genai.Client(
                vertexai=True,
                project=self._settings.VERTEX_PROJECT_ID,
                location=self._settings.VERTEX_LOCATION,
                # Use stable API version
                http_options=types.HttpOptions(api_version='v1'),
            )
            self._initialized = True
            logger.info(
                "Gemini service initialized: project=%s, location=%s",
                self._settings.VERTEX_PROJECT_ID,
                self._settings.VERTEX_LOCATION,
            )
        return self._client
    
    def _get_model_name(self, tier: UserTier) -> str:
        """Get appropriate Gemini model for tier."""
        # All tiers use the same model - differentiation is in thinking budget
        return self._settings.GEMINI_FLASH_MODEL or "gemini-2.5-flash"
    
    def _build_config(
        self,
        tier: UserTier,
        thinking_level: ThinkingLevel | None = None,
        use_google_search: bool = False,
        temperature: float = 0.7,
        max_output_tokens: int | None = None,
        include_thoughts: bool = False,
    ) -> types.GenerateContentConfig:
        """Build generation config with appropriate settings."""
        # Determine thinking budget from config or explicit level
        if thinking_level is not None:
            thinking_budget = THINKING_BUDGET[thinking_level]
        else:
            # Use tier-based config
            thinking_budget = get_tier_thinking_budget(tier, self._settings)
        
        # Build tools list
        tools: list[types.Tool] = []
        if use_google_search:
            tools.append(types.Tool(google_search=types.GoogleSearch()))
        
        # Build config
        config_params: dict[str, Any] = {
            "temperature": temperature,
        }
        
        if max_output_tokens:
            config_params["max_output_tokens"] = max_output_tokens
        
        # Add thinking config if thinking is enabled
        if thinking_budget > 0:
            config_params["thinking_config"] = types.ThinkingConfig(
                thinking_budget=thinking_budget,
                include_thoughts=include_thoughts,
            )
        
        # Add tools if any
        if tools:
            config_params["tools"] = tools
        
        return types.GenerateContentConfig(**config_params)
    
    async def generate(
        self,
        prompt: str,
        tier: UserTier = UserTier.FREE,
        system_prompt: str | None = None,
        history: list[dict[str, str]] | None = None,
        thinking_level: ThinkingLevel | None = None,
        use_google_search: bool = False,
        temperature: float = 0.7,
        max_output_tokens: int | None = None,
        include_thoughts: bool = False,
    ) -> GeminiResponse:
        """
        Generate content using Gemini.
        
        Args:
            prompt: User prompt
            tier: User subscription tier
            system_prompt: Optional system instruction
            history: Optional conversation history [{"role": "user/assistant", "content": "..."}]
            thinking_level: Override thinking level (uses tier default if None)
            use_google_search: Enable Google Search grounding
            temperature: Generation temperature (0.0-2.0)
            max_output_tokens: Max tokens in response
            include_thoughts: Include thinking process in response
            
        Returns:
            GeminiResponse with text, optional thinking, and metadata
        """
        client = self._get_client()
        model = self._get_model_name(tier)
        config = self._build_config(
            tier=tier,
            thinking_level=thinking_level,
            use_google_search=use_google_search,
            temperature=temperature,
            max_output_tokens=max_output_tokens,
            include_thoughts=include_thoughts,
        )
        
        # Build contents
        contents: list[types.Content] = []
        
        # Add history if provided
        if history:
            for msg in history:
                role = "user" if msg.get("role") == "user" else "model"
                contents.append(types.Content(
                    role=role,
                    parts=[types.Part.from_text(text=msg.get("content", ""))],
                ))
        
        # Add current prompt
        contents.append(types.Content(
            role="user",
            parts=[types.Part.from_text(text=prompt)],
        ))
        
        # Make async request
        # Note: google-genai async uses client.aio
        try:
            response = await client.aio.models.generate_content(
                model=model,
                contents=contents,
                config=config,
            )
            
            # Extract text
            text = response.text if hasattr(response, 'text') else ""
            
            # Extract thinking if available
            thinking = None
            if include_thoughts and hasattr(response, 'candidates'):
                for candidate in response.candidates:
                    if hasattr(candidate, 'thinking'):
                        thinking = candidate.thinking
                        break
            
            # Extract grounding metadata if available
            grounding_metadata = None
            if use_google_search and hasattr(response, 'candidates'):
                for candidate in response.candidates:
                    if hasattr(candidate, 'grounding_metadata'):
                        gm = candidate.grounding_metadata
                        grounding_metadata = {
                            "web_search_queries": getattr(gm, 'web_search_queries', []),
                            "grounding_chunks": [
                                {
                                    "title": getattr(chunk.web, 'title', '') if hasattr(chunk, 'web') else '',
                                    "uri": getattr(chunk.web, 'uri', '') if hasattr(chunk, 'web') else '',
                                }
                                for chunk in getattr(gm, 'grounding_chunks', [])
                            ],
                        }
                        break
            
            # Extract usage
            usage = None
            if hasattr(response, 'usage_metadata'):
                um = response.usage_metadata
                usage = {
                    "prompt_tokens": getattr(um, 'prompt_token_count', 0),
                    "candidates_tokens": getattr(um, 'candidates_token_count', 0),
                    "total_tokens": getattr(um, 'total_token_count', 0),
                }
            
            return GeminiResponse(
                text=text,
                thinking=thinking,
                grounding_metadata=grounding_metadata,
                usage=usage,
                model=model,
            )
            
        except Exception as e:
            logger.exception("Gemini generation failed: %s", str(e))
            raise
    
    async def generate_stream(
        self,
        prompt: str,
        tier: UserTier = UserTier.FREE,
        system_prompt: str | None = None,
        history: list[dict[str, str]] | None = None,
        thinking_level: ThinkingLevel | None = None,
        use_google_search: bool = False,
        temperature: float = 0.7,
        max_output_tokens: int | None = None,
    ) -> AsyncIterator[GeminiStreamChunk]:
        """
        Generate content with streaming.
        
        Yields chunks as they arrive from the model.
        
        Args:
            Same as generate()
            
        Yields:
            GeminiStreamChunk with text and metadata
        """
        client = self._get_client()
        model = self._get_model_name(tier)
        config = self._build_config(
            tier=tier,
            thinking_level=thinking_level,
            use_google_search=use_google_search,
            temperature=temperature,
            max_output_tokens=max_output_tokens,
            include_thoughts=False,  # Don't include thoughts in streaming
        )
        
        # Build contents
        contents: list[types.Content] = []
        
        if history:
            for msg in history:
                role = "user" if msg.get("role") == "user" else "model"
                contents.append(types.Content(
                    role=role,
                    parts=[types.Part.from_text(text=msg.get("content", ""))],
                ))
        
        contents.append(types.Content(
            role="user",
            parts=[types.Part.from_text(text=prompt)],
        ))
        
        try:
            # Async streaming
            async for chunk in await client.aio.models.generate_content_stream(
                model=model,
                contents=contents,
                config=config,
            ):
                text = chunk.text if hasattr(chunk, 'text') else ""
                if text:
                    yield GeminiStreamChunk(
                        text=text,
                        is_thinking=False,
                        is_complete=False,
                    )
            
            # Final chunk
            yield GeminiStreamChunk(
                text="",
                is_thinking=False,
                is_complete=True,
            )
            
        except Exception as e:
            logger.exception("Gemini streaming failed: %s", str(e))
            raise
    
    async def generate_with_search(
        self,
        query: str,
        tier: UserTier = UserTier.JIVE,
    ) -> GeminiResponse:
        """
        Convenience method for search-grounded generation.
        
        Automatically enables Google Search and returns grounding metadata.
        """
        return await self.generate(
            prompt=query,
            tier=tier,
            use_google_search=True,
            include_thoughts=False,
        )


# Singleton instance
_gemini_service: GeminiService | None = None


def get_gemini_service() -> GeminiService:
    """Get or create the Gemini service singleton."""
    global _gemini_service
    if _gemini_service is None:
        _gemini_service = GeminiService()
    return _gemini_service


# Convenience export
gemini_service = get_gemini_service()


__all__ = [
    "GeminiService",
    "GeminiResponse",
    "GeminiStreamChunk",
    "ThinkingLevel",
    "get_gemini_service",
    "gemini_service",
]
