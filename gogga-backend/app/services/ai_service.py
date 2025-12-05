"""
GOGGA AI Service - Tier-Based Text Routing.

Routes text requests based on user tier:
- FREE: OpenRouter Llama 3.3 70B FREE
- JIVE: Cerebras Llama 3.1 8B (direct or + CePO)
- JIGGA: Cerebras Qwen 3 235B (thinking or /no_think)

Universal prompt enhancement: OpenRouter Llama 3.3 70B FREE (all tiers)

Rate Limit Handling:
- Retry with exponential backoff (3 attempts)
- Fallback to OpenRouter when Cerebras is rate-limited
"""
import logging
import time
import asyncio
import re
from typing import Any, Final

from cerebras.cloud.sdk import Cerebras

from app.config import settings
from app.core.router import (
    tier_router, CognitiveLayer, UserTier,
    QWEN_THINKING_SETTINGS, QWEN_FAST_SETTINGS
)
from app.services.cost_tracker import track_usage
from app.core.exceptions import InferenceError


logger = logging.getLogger(__name__)

# Constants
MAX_HISTORY_TURNS: Final[int] = 10
DEFAULT_TEMPERATURE: Final[float] = 0.7
DEFAULT_MAX_TOKENS: Final[int] = 4096
JIGGA_MAX_TOKENS: Final[int] = 8000  # Qwen 3 32B max output tokens
DEFAULT_TOP_P: Final[float] = 0.95

# Retry configuration for rate limits
MAX_RETRIES: Final[int] = 3
INITIAL_BACKOFF_SECONDS: Final[float] = 1.0
BACKOFF_MULTIPLIER: Final[float] = 2.0

# Regex pattern to extract <think>...</think> or <thinking>...</thinking> blocks
# Qwen 3 may use either format depending on configuration
THINK_PATTERN: Final[re.Pattern] = re.compile(
    r'<think(?:ing)?>(.*?)</think(?:ing)?>',
    re.DOTALL | re.IGNORECASE
)

# Type aliases
MessageDict = dict[str, str]
ResponseDict = dict[str, Any]

# Cerebras client (lazy init)
_client: Cerebras | None = None


def get_client() -> Cerebras:
    """Get or create the Cerebras client instance."""
    global _client
    if _client is None:
        _client = Cerebras(api_key=settings.CEREBRAS_API_KEY)
    return _client


def parse_thinking_response(content: str) -> tuple[str, str | None]:
    """
    Parse Qwen's response to separate thinking from main response.
    
    Qwen 3 outputs thinking in <think>...</think> tags when enable_thinking=True.
    This function extracts the thinking block and returns it separately.
    
    Args:
        content: The raw response from Qwen
        
    Returns:
        Tuple of (main_response, thinking_block or None)
    """
    # Find all thinking blocks using walrus operator
    if thinking_matches := THINK_PATTERN.findall(content):
        # Combine all thinking blocks if multiple exist
        thinking = "\n\n".join(thinking_matches).strip()
        
        # Remove thinking blocks from content to get main response
        main_response = THINK_PATTERN.sub('', content).strip()
        
        return main_response, thinking
    
    # No thinking block found - return content as-is
    return content, None


class AIService:
    """
    Tier-based AI Service for text generation.
    
    FREE Tier:
        → OpenRouter Llama 3.3 70B FREE
        
    JIVE Tier:
        Simple → Cerebras Llama 3.1 8B direct
        Complex → Cerebras Llama 3.1 8B + CePO
        
    JIGGA Tier:
        Thinking → Cerebras Qwen 3 235B (temp=0.6, top_p=0.95)
        Fast → Cerebras Qwen 3 235B + /no_think
    """
    
    @staticmethod
    async def generate_response(
        user_id: str,
        message: str,
        history: list[MessageDict] | None = None,
        user_tier: UserTier = UserTier.FREE,
        force_layer: CognitiveLayer | None = None,
        context_tokens: int = 0
    ) -> ResponseDict:
        """
        Generate a response based on user tier.
        
        Args:
            user_id: Unique identifier for the user
            message: The user's input message
            history: Optional conversation history
            user_tier: User's subscription tier
            force_layer: Optional layer override
            context_tokens: Number of tokens in context (for JIGGA thinking mode)
            
        Returns:
            Dict containing the response and metadata
        """
        # Determine which layer to use
        if force_layer:
            layer = force_layer
        else:
            layer = tier_router.classify_intent(message, user_tier, context_tokens)
        
        # Route based on layer
        if layer == CognitiveLayer.FREE_TEXT:
            return await AIService._generate_free(user_id, message, history)
        
        elif layer == CognitiveLayer.JIVE_SPEED:
            return await AIService._generate_cerebras(
                user_id, message, history, layer,
                use_cepo=False
            )
        
        elif layer == CognitiveLayer.JIVE_REASONING:
            return await AIService._generate_cerebras(
                user_id, message, history, layer,
                use_cepo=True
            )
        
        elif layer == CognitiveLayer.JIGGA_THINK:
            return await AIService._generate_cerebras(
                user_id, message, history, layer,
                use_cepo=False,
                thinking_mode=True
            )
        
        elif layer == CognitiveLayer.JIGGA_FAST:
            return await AIService._generate_cerebras(
                user_id, message, history, layer,
                use_cepo=False,
                append_no_think=True
            )
        
        # Default fallback
        return await AIService._generate_free(user_id, message, history)
    
    @staticmethod
    async def _generate_free(
        user_id: str,
        message: str,
        history: list[MessageDict] | None
    ) -> ResponseDict:
        """
        FREE tier: OpenRouter Llama 3.3 70B.
        """
        from app.services.openrouter_service import openrouter_service
        
        system_prompt = tier_router.get_system_prompt(CognitiveLayer.FREE_TEXT)
        
        logger.info(
            f"FREE text | user={user_id} | prompt={message[:50]}..." if len(message) > 50 else f"FREE text | user={user_id} | prompt={message}"
        )
        
        return await openrouter_service.chat_free(
            message=message,
            system_prompt=system_prompt,
            history=history,
            user_id=user_id
        )
    
    @staticmethod
    async def _generate_cerebras(
        user_id: str,
        message: str,
        history: list[MessageDict] | None,
        layer: CognitiveLayer,
        use_cepo: bool = False,
        thinking_mode: bool = False,
        append_no_think: bool = False
    ) -> ResponseDict:
        """
        JIVE/JIGGA tier: Cerebras Llama or Qwen.

        Args:
            use_cepo: Route through CePO sidecar (JIVE reasoning)
            thinking_mode: Use Qwen thinking settings (JIGGA)
            append_no_think: Append /no_think to message (JIGGA fast)

        Returns:
            ResponseDict with 'response', 'thinking' (if applicable), and 'meta'
        """
        from app.core.router import is_document_analysis_request, COMPREHENSIVE_OUTPUT_INSTRUCTION
        
        config = tier_router.get_model_config(layer)
        model_id = config["model"]
        system_prompt = tier_router.get_system_prompt(layer)

        # Determine if this is JIGGA tier
        is_jigga = layer in (CognitiveLayer.JIGGA_THINK, CognitiveLayer.JIGGA_FAST)
        tier = "jigga" if is_jigga else "jive"

        # Check for document/analysis request - add comprehensive output instruction
        actual_message = message
        is_doc_request = is_document_analysis_request(message)

        if is_doc_request and (thinking_mode or use_cepo):
            # Only add comprehensive instruction for reasoning modes (JIVE CePO or JIGGA thinking)
            actual_message = f"{message}{COMPREHENSIVE_OUTPUT_INSTRUCTION}"
            logger.info("Document/analysis request detected - comprehensive output mode enabled")

        # Append /no_think for JIGGA fast mode
        if append_no_think:
            actual_message = f"{actual_message} /no_think"
            logger.info("JIGGA fast mode - appending /no_think")

        # Route through CePO if enabled
        if use_cepo:
            return await AIService._generate_with_cepo(
                user_id, actual_message, history, layer, model_id, system_prompt
            )

        start_time = time.perf_counter()

        # Build messages
        messages: list[MessageDict] = [{"role": "system", "content": system_prompt}]
        if history:
            messages.extend(history[-MAX_HISTORY_TURNS:])
        messages.append({"role": "user", "content": actual_message})

        # Set generation parameters based on tier and mode
        # JIGGA tier uses specific settings for thinking/non-thinking
        # DO NOT use greedy decoding (temp=0) - causes performance degradation
        if is_jigga:
            if thinking_mode:
                # Qwen thinking mode: temp=0.6, top_p=0.95, top_k=20, min_p=0
                temperature = QWEN_THINKING_SETTINGS["temperature"]
                top_p = QWEN_THINKING_SETTINGS["top_p"]
                max_tokens = QWEN_THINKING_SETTINGS.get("max_tokens", JIGGA_MAX_TOKENS)
                logger.info("JIGGA thinking mode - temp=0.6, top_p=0.95, top_k=20, min_p=0")
            else:
                # Qwen fast mode: temp=0.7, top_p=0.8, top_k=20, min_p=0
                temperature = QWEN_FAST_SETTINGS["temperature"]
                top_p = QWEN_FAST_SETTINGS["top_p"]
                max_tokens = QWEN_FAST_SETTINGS.get("max_tokens", JIGGA_MAX_TOKENS)
                logger.info("JIGGA fast mode - temp=0.7, top_p=0.8, top_k=20, min_p=0")
        else:
            # JIVE tier (Llama 3.1 8B)
            temperature = DEFAULT_TEMPERATURE
            top_p = DEFAULT_TOP_P
            max_tokens = DEFAULT_MAX_TOKENS

        try:
            client = get_client()

            # Retry loop with exponential backoff for rate limits
            last_error = None
            for attempt in range(MAX_RETRIES):
                try:
                    response = await asyncio.to_thread(
                        client.chat.completions.create,
                        messages=messages,
                        model=model_id,
                        temperature=temperature,
                        max_tokens=max_tokens,
                        top_p=top_p
                    )
                    break  # Success - exit retry loop

                except Exception as e:
                    error_str = str(e)
                    # Check for rate limit (429)
                    if "429" not in error_str and "too_many_requests" not in error_str.lower():
                        # Non-rate-limit error - raise immediately
                        raise
                    last_error = e
                    if attempt < MAX_RETRIES - 1:
                        backoff = INITIAL_BACKOFF_SECONDS * (BACKOFF_MULTIPLIER ** attempt)
                        logger.warning(
                            "GOGGA AI busy (attempt %d/%d), retrying in %.1fs...",
                            attempt + 1, MAX_RETRIES, backoff
                        )
                        await asyncio.sleep(backoff)
                        continue
                    # All retries exhausted - fallback to OpenRouter
                    logger.warning(
                        "GOGGA AI temporarily busy, using backup service..."
                    )
                    return await AIService._fallback_to_openrouter(
                        user_id, actual_message, history, layer, tier
                    )
            else:
                # Loop completed without break (shouldn't happen, but safety check)
                if last_error:
                    return await AIService._fallback_to_openrouter(
                        user_id, actual_message, history, layer, tier
                    )

            usage = response.usage
            raw_content = response.choices[0].message.content
            latency = time.perf_counter() - start_time

            # Parse thinking block from response (JIGGA thinking mode)
            # Qwen wraps its reasoning in <think>...</think> tags
            main_response, thinking_block = parse_thinking_response(raw_content)

            if thinking_block:
                logger.info(
                    "Parsed thinking block | length=%d chars",
                    len(thinking_block)
                )

            # Track usage with tier for proper pricing
            cost_data = await track_usage(
                user_id=user_id,
                model=model_id,
                layer=layer.value,
                input_tokens=usage.prompt_tokens,
                output_tokens=usage.completion_tokens,
                tier=tier
            )

            logger.info(
                "Cerebras complete | tier=%s | layer=%s | latency=%.2fs | tokens=%d/%d",
                tier, layer.value, latency, usage.prompt_tokens, usage.completion_tokens
            )

            result: ResponseDict = {
                "response": main_response,
                "meta": {
                    "tier": tier,
                    "layer": layer.value,
                    "model": model_id,
                    "provider": "cerebras",
                    "thinking_mode": thinking_mode,
                    "no_think": append_no_think,
                    "latency_seconds": round(latency, 3),
                    "tokens": {
                        "input": usage.prompt_tokens,
                        "output": usage.completion_tokens
                    },
                    "cost_usd": cost_data["usd"],
                    "cost_zar": cost_data["zar"]
                }
            }

            # Include thinking block separately if present (for UI to display collapsed)
            if thinking_block:
                result["thinking"] = thinking_block
                result["meta"]["has_thinking"] = True

            return result

        except Exception as e:
            error_str = str(e)
            # Log internal details but show user-friendly message
            logger.error("GOGGA AI service error: %s", error_str)

            # Check for rate limit in the outer exception handler too
            if "429" in error_str or "too_many_requests" in error_str.lower():
                raise InferenceError(
                    "GOGGA AI is experiencing high demand. Please try again in a moment."
                ) from e

            raise InferenceError(
                "GOGGA AI encountered an issue. Please try again."
            ) from e
    
    @staticmethod
    async def _generate_with_cepo(
        user_id: str,
        message: str,
        history: list[MessageDict] | None,
        layer: CognitiveLayer,
        model_id: str,
        system_prompt: str
    ) -> ResponseDict:
        """
        JIVE reasoning: Llama 3.1 8B + CePO.
        """
        from app.services.cepo_service import cepo_service
        
        logger.info("JIVE reasoning mode - routing through CePO")
        
        try:
            result = await cepo_service.generate_with_cepo(
                message=message,
                system_prompt=system_prompt,
                history=history,
                model=model_id
            )
            
            # Add tier info
            result["meta"]["tier"] = "jive"
            result["meta"]["provider"] = "cerebras+cepo"
            
            # Track usage
            if "tokens" in result.get("meta", {}):
                await track_usage(
                    user_id=user_id,
                    model=model_id,
                    layer=layer.value,
                    input_tokens=result["meta"]["tokens"].get("input", 0),
                    output_tokens=result["meta"]["tokens"].get("output", 0)
                )
            
            return result
            
        except Exception as e:
            logger.warning("CePO failed, falling back to direct: %s", e)
            # Fallback to direct Cerebras
            return await AIService._generate_cerebras(
                user_id, message, history, 
                CognitiveLayer.JIVE_SPEED,
                use_cepo=False
            )
    
    @staticmethod
    async def _fallback_to_openrouter(
        user_id: str,
        message: str,
        history: list[MessageDict] | None,
        original_layer: CognitiveLayer,
        original_tier: str
    ) -> ResponseDict:
        """
        Fallback to OpenRouter when primary service is rate-limited.
        
        Uses the same Llama 3.3 70B as FREE tier but tracks separately.
        User sees seamless response without knowing about the fallback.
        """
        from app.services.openrouter_service import openrouter_service
        
        logger.info(
            "Fallback to OpenRouter | user=%s | original_tier=%s",
            user_id, original_tier
        )
        
        # Use a system prompt appropriate for the tier's expected quality
        system_prompt = tier_router.get_system_prompt(original_layer)
        
        try:
            result = await openrouter_service.chat_free(
                message=message,
                system_prompt=system_prompt,
                history=history,
                user_id=user_id
            )
            
            # Update meta to reflect the fallback (internal only, not shown to user)
            result["meta"]["tier"] = original_tier
            result["meta"]["provider"] = "openrouter_fallback"
            result["meta"]["fallback_reason"] = "high_traffic"
            result["meta"]["layer"] = original_layer.value
            
            logger.info(
                "Fallback complete | tier=%s | latency=%.2fs",
                original_tier, result["meta"].get("latency_seconds", 0)
            )
            
            return result
            
        except Exception as e:
            logger.error("Fallback also failed: %s", e)
            raise InferenceError(
                "GOGGA AI is experiencing high demand. Please try again in a moment."
            ) from e
    
    @staticmethod
    async def health_check() -> ResponseDict:
        """Check Cerebras connection health."""
        try:
            start_time = time.perf_counter()
            
            client = get_client()
            await asyncio.to_thread(
                client.chat.completions.create,
                messages=[{"role": "user", "content": "Hi"}],
                model=settings.MODEL_SPEED,
                max_tokens=5
            )
            
            latency = time.perf_counter() - start_time
            
            return {
                "status": "healthy",
                "provider": "cerebras",
                "latency_ms": round(latency * 1000, 2)
            }
        except Exception as e:
            logger.error("Health check failed: %s", e)
            return {
                "status": "unhealthy",
                "error": str(e)
            }


# Singleton instance
ai_service = AIService()

# Backwards compatibility
bicameral_router = tier_router
