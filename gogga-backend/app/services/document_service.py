"""
Gogga Document Service - Document Generation with AI

Handles document generation requests by:
1. Classifying the document request
2. Building sophisticated prompts
3. Routing to appropriate AI model
4. Generating and returning documents

Integrates with existing AIService, TierRouter, cost tracking, and retry logic.

IMPROVEMENTS (Jan 2025):
- Accurate token tracking from API response (not estimates)
- Cost tracking via cost_tracker.track_usage()
- Retry logic with exponential backoff for robustness
- Leverages TierRouter patterns for consistent routing
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from typing import Any

from app.tools.document_classifier import DocumentClassifier
from app.tools.document_definitions import (
    DocumentComplexity,
    DocumentProfile,
    DocumentToolInput,
    DocumentToolOutput,
    SA_LANGUAGES,
)
from app.tools.document_templates import DocumentTemplateEngine
from app.config import settings
from app.core.retry import with_retry, RetryConfig

logger = logging.getLogger(__name__)


# Language code to name mapping
LANGUAGE_CODE_TO_NAME: dict[str, str] = {
    "en": "English",
    "af": "Afrikaans",
    "zu": "isiZulu",
    "xh": "isiXhosa",
    "st": "Sesotho",
    "tn": "Setswana",
    "ve": "Tshivenḓa",
    "ts": "Xitsonga",
    "nr": "isiNdebele",
    "ss": "siSwati",
    "nso": "Sepedi",
}


@dataclass
class GenerationResult:
    """Result from AI generation with token tracking"""
    content: str
    input_tokens: int
    output_tokens: int
    reasoning_tokens: int
    model: str
    provider: str


# Retry configuration for document generation (faster retries for rate limits)
DOCUMENT_RETRY_CONFIG = RetryConfig(
    initial_delay_ms=500,
    multiplier=2.0,
    max_delay_ms=4000,
    jitter_max_ms=100,
    max_attempts=3,
)


class DocumentService:
    """
    Document generation service.
    
    Handles the complete document generation flow:
    1. Language detection (if not specified)
    2. Document classification
    3. Prompt building
    4. Model selection and generation
    5. Output formatting
    """
    
    _instance: DocumentService | None = None
    
    def __new__(cls) -> DocumentService:
        """Singleton pattern for service instance"""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self) -> None:
        if self._initialized:
            return
        self._classifier = DocumentClassifier()
        self._template_engine = DocumentTemplateEngine()
        self._initialized = True
        logger.info("DocumentService initialized")
    
    async def generate(
        self,
        input_data: DocumentToolInput,
        user_tier: str,
        language_intel: dict[str, Any] | None = None,
        user_id: str = "document_tool",
    ) -> DocumentToolOutput:
        """
        Generate a document based on tool input.
        
        This is the main entry point called when the AI invokes
        the document tool or via direct API call.
        
        Args:
            input_data: Validated document tool input
            user_tier: User's subscription tier (FREE, JIVE, JIGGA)
            language_intel: Optional pre-detected language from plugin
            user_id: User identifier for cost tracking
            
        Returns:
            DocumentToolOutput with generated content, token counts, and costs
        """
        # Step 1: Determine language
        if input_data.language:
            language_code = input_data.language.lower()
            language_name = LANGUAGE_CODE_TO_NAME.get(language_code, "English")
        elif language_intel:
            language_code = language_intel.get("code", "en")
            language_name = language_intel.get("name", "English")
        else:
            # Default to English
            language_code = "en"
            language_name = "English"
        
        # Step 2: Classify document request
        profile = self._classifier.classify(input_data.content, language_code)
        
        logger.info(
            f"Document classified: domain={profile.domain.value}, "
            f"type={profile.document_type}, complexity={profile.complexity.value}, "
            f"requires_235b={profile.requires_235b}, language={language_code}"
        )
        
        # Step 3: Build prompt
        prompt = self._template_engine.build_prompt(
            user_content=input_data.content,
            profile=profile,
            language_code=language_code,
            language_name=language_name,
            formality=input_data.formality,
            sa_context=input_data.include_sa_context,
            custom_instructions=input_data.additional_requirements,
        )
        
        # Step 4: Get generation config
        config = self._get_generation_config(profile, user_tier)
        
        logger.info(
            f"Document generation config: model={config['model']}, "
            f"max_tokens={config['max_tokens']}, thinking={config['thinking_mode']}"
        )
        
        # Step 5: Generate via AI with token tracking
        result = await self._generate_document(prompt, config, user_tier)
        
        # Step 6: Track cost via cost_tracker
        cost_data = await self._track_generation_cost(
            user_id=user_id,
            tier=user_tier,
            result=result,
            thinking_mode=config["thinking_mode"],
        )
        
        # Step 7: Build output with accurate token counts
        title = self._extract_title(result.content)
        
        return DocumentToolOutput(
            title=title,
            content=result.content,
            domain=profile.domain.value,
            document_type=profile.document_type,
            language=language_name,
            word_count=len(result.content.split()),
            model_used=result.model,
            thinking_mode=config["thinking_mode"],
            # Accurate token tracking from API response
            input_tokens=result.input_tokens,
            output_tokens=result.output_tokens,
            reasoning_tokens=result.reasoning_tokens,
            cost_usd=cost_data.get("usd", 0.0),
            cost_zar=cost_data.get("zar", 0.0),
        )
    
    async def _track_generation_cost(
        self,
        user_id: str,
        tier: str,
        result: GenerationResult,
        thinking_mode: bool,
    ) -> dict[str, float]:
        """
        Track generation cost via cost_tracker service.
        
        Integrates with existing cost tracking for accurate billing.
        
        Returns:
            Dict with 'usd' and 'zar' cost values
        """
        from app.services.cost_tracker import track_usage, UsageCost
        
        # Determine layer based on provider/model
        if result.provider == "openrouter":
            layer = "free_text" if "235b" in result.model.lower() else "free_text"
        else:
            layer = "jigga_think" if thinking_mode else "jive_text"
        
        try:
            cost_data: UsageCost = await track_usage(
                user_id=user_id,
                model=result.model,
                layer=layer,
                input_tokens=result.input_tokens,
                output_tokens=result.output_tokens,
                tier=tier,
                optillm_level="none",  # Document tool doesn't use OptiLLM
                reasoning_tokens=result.reasoning_tokens,
            )
            return {"usd": cost_data["usd"], "zar": cost_data["zar"]}
        except Exception as e:
            logger.warning(f"Failed to track document generation cost: {e}")
            return {"usd": 0.0, "zar": 0.0}
    
    def _get_generation_config(
        self, 
        profile: DocumentProfile, 
        user_tier: str
    ) -> dict[str, Any]:
        """
        Determine generation config based on profile and tier.
        
        Token budget allocation:
        - 235B (non-thinking): All tokens go to output
        - 32B (thinking): ~2000 reasoning + rest output
        
        Args:
            profile: Document classification profile
            user_tier: User tier string
            
        Returns:
            Generation configuration dict
        """
        tier_lower = user_tier.lower() if user_tier else "free"
        
        # 235B required cases (African languages, complex, expert)
        if profile.requires_235b:
            return {
                "model": settings.MODEL_JIGGA_235B if hasattr(settings, 'MODEL_JIGGA_235B') else "qwen/qwen3-235b-a22b-instruct-2507",
                "provider": "openrouter",
                "thinking_mode": False,  # Non-thinking for max output
                "max_tokens": min(profile.estimated_tokens, 30000),
                "temperature": 0.7,
            }
        
        # FREE tier always uses 235B via OpenRouter
        if tier_lower == "free":
            return {
                "model": settings.MODEL_FREE if hasattr(settings, 'MODEL_FREE') else "qwen/qwen3-235b-a22b-instruct-2507",
                "provider": "openrouter",
                "thinking_mode": False,
                "max_tokens": min(profile.estimated_tokens, 8000),
                "temperature": 0.7,
            }
        
        # JIVE/JIGGA use 32B via Cerebras
        if profile.reasoning_required:
            return {
                "model": settings.MODEL_JIVE if hasattr(settings, 'MODEL_JIVE') else "qwen-3-32b",
                "provider": "cerebras",
                "thinking_mode": True,
                "max_tokens": 8000,  # ~2000 reasoning + ~6000 output
                "temperature": 0.6,  # NEVER 0 for thinking mode!
            }
        
        return {
            "model": settings.MODEL_JIVE if hasattr(settings, 'MODEL_JIVE') else "qwen-3-32b",
            "provider": "cerebras",
            "thinking_mode": False,
            "max_tokens": min(profile.estimated_tokens, 8000),
            "temperature": 0.7,
        }
    
    async def _generate_document(
        self,
        prompt: str,
        config: dict[str, Any],
        user_tier: str,
    ) -> GenerationResult:
        """
        Generate document content via AI service with token tracking.
        
        Routes to appropriate provider based on config.
        Uses retry logic for robustness.
        
        Args:
            prompt: Complete prompt for generation
            config: Generation configuration
            user_tier: User tier
            
        Returns:
            GenerationResult with content and token counts
        """
        provider = config.get("provider", "openrouter")
        
        if provider == "openrouter":
            return await self._generate_via_openrouter(prompt, config)
        else:
            return await self._generate_via_cerebras(prompt, config, user_tier)
    
    @with_retry(config=DOCUMENT_RETRY_CONFIG, operation_name="openrouter_document")
    async def _generate_via_openrouter(
        self,
        prompt: str,
        config: dict[str, Any],
    ) -> GenerationResult:
        """
        Generate via OpenRouter (FREE tier and 235B).
        
        Uses _chat_completion directly for max_tokens control.
        Returns GenerationResult with accurate token counts from API.
        """
        from app.services.openrouter_service import openrouter_service
        
        system_prompt = "You are Gogga, a professional South African document specialist."
        model = config.get("model", "qwen/qwen3-235b-a22b-instruct-2507")
        max_tokens = config.get("max_tokens", 8000)
        
        # Build messages
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt},
        ]
        
        # Use _chat_completion directly for max_tokens control
        result = await openrouter_service._chat_completion(
            model=model,
            messages=messages,
            max_tokens=max_tokens,
            temperature=0.7,
        )
        
        # Extract token counts from response
        usage = result.get("usage", {})
        
        return GenerationResult(
            content=result.get("content", ""),
            input_tokens=usage.get("prompt_tokens", 0),
            output_tokens=usage.get("completion_tokens", 0),
            reasoning_tokens=0,  # OpenRouter doesn't separate reasoning
            model=model,
            provider="openrouter",
        )
    
    @with_retry(config=DOCUMENT_RETRY_CONFIG, operation_name="cerebras_document")
    async def _generate_via_cerebras(
        self,
        prompt: str,
        config: dict[str, Any],
        user_tier: str,
    ) -> GenerationResult:
        """
        Generate via Cerebras (JIVE/JIGGA tiers).
        
        Returns GenerationResult with accurate token counts from API.
        Includes retry logic and fallback to OpenRouter.
        """
        from app.services.ai_service import get_client, parse_thinking_response
        from app.core.router import QWEN_THINKING_SETTINGS
        
        model_id = config.get("model", "qwen-3-32b")
        max_tokens = config.get("max_tokens", 8000)
        temperature = config.get("temperature", 0.6)
        thinking_mode = config.get("thinking_mode", False)
        
        # Build messages - use cast-compatible format
        messages: list[dict[str, Any]] = [
            {"role": "system", "content": "You are Gogga, a professional South African document specialist."},
            {"role": "user", "content": prompt},
        ]
        
        # Get Cerebras client
        client, api_key = get_client()
        
        try:
            response = await asyncio.to_thread(
                client.chat.completions.create,
                model=model_id,
                messages=messages,  # type: ignore[arg-type]
                temperature=temperature if not thinking_mode else QWEN_THINKING_SETTINGS["temperature"],
                top_p=QWEN_THINKING_SETTINGS["top_p"] if thinking_mode else 0.95,
                max_completion_tokens=max_tokens,
            )
            
            content = response.choices[0].message.content or ""  # type: ignore[union-attr]
            
            # Get token usage from response - with safe extraction
            usage = getattr(response, "usage", None)
            input_tokens = int(getattr(usage, "prompt_tokens", 0) or 0) if usage else 0
            output_tokens = int(getattr(usage, "completion_tokens", 0) or 0) if usage else 0
            
            # If thinking mode, parse out thinking block
            reasoning_tokens = 0
            if thinking_mode:
                main_response, thinking_block = parse_thinking_response(content)
                content = main_response
                # Estimate reasoning tokens from thinking block length
                if thinking_block:
                    # Rough estimate: 1 token ≈ 4 chars
                    reasoning_tokens = len(thinking_block) // 4
            
            return GenerationResult(
                content=content,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                reasoning_tokens=reasoning_tokens,
                model=model_id,
                provider="cerebras",
            )
            
        except Exception as e:
            logger.error(f"Cerebras generation error: {e}")
            # Fallback to OpenRouter - will be retried by decorator
            raise
    
    def _extract_title(self, content: str) -> str:
        """
        Extract document title from generated content.
        
        Tries multiple patterns:
        1. Markdown heading (#)
        2. Bold text (**)
        3. First non-empty line
        """
        lines = content.strip().split("\n")
        
        for line in lines[:10]:
            line = line.strip()
            if not line:
                continue
            
            # Markdown heading
            if line.startswith("#"):
                return line.lstrip("#").strip()[:100]
            
            # Bold title
            if line.startswith("**") and line.endswith("**"):
                return line.strip("*").strip()[:100]
            
            # First substantial line
            if len(line) > 5:
                return line[:100]
        
        return "Untitled Document"


# Singleton accessor
_document_service: DocumentService | None = None


def get_document_service() -> DocumentService:
    """Get or create the document service singleton"""
    global _document_service
    if _document_service is None:
        _document_service = DocumentService()
    return _document_service
