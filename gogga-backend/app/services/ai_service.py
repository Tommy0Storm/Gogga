"""
GOGGA AI Service - Tier-Based Text Routing.

SIMPLIFIED ARCHITECTURE (2025-01):
- FREE: OpenRouter Qwen 3 235B FREE
- JIVE: Cerebras Qwen 3 32B (thinking mode)
- JIGGA: Cerebras Qwen 3 32B (general) or 235B (complex/legal)

Universal prompt enhancement: OpenRouter Qwen 3 235B FREE (all tiers)

Rate Limit Handling:
- Retry with exponential backoff (3 attempts)
- Fallback to OpenRouter when Cerebras is rate-limited

Plugin System:
- Language Detection: Runs on EVERY request (cannot be disabled)
- Enriches context with language intelligence before LLM processing

CePO Integration:
- JIVE/JIGGA tiers route through CePO sidecar for enhanced reasoning
- 4-step pipeline: Plan → Solution → Refine → Final + Best of N selection
- Automatic failsafe to direct Cerebras API on CePO failure
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
    QWEN_THINKING_SETTINGS,
    is_extended_output_request, is_document_analysis_request,
    QWEN_MAX_TOKENS, QWEN_DEFAULT_TOKENS,
    JIGGA_235B_MAX_TOKENS,
    COMPREHENSIVE_OUTPUT_INSTRUCTION,
    COMPLEX_235B_KEYWORDS,
)
from app.services.cost_tracker import track_usage
from app.services.cepo_service import get_cepo_service, CePoConfig
from app.services.optillm_enhancements import (
    get_enhancement_config,
    enhance_system_prompt,
    enhance_user_message,
    should_use_planning,
    parse_enhanced_response,
    EnhancementLevel,
)
from app.core.exceptions import InferenceError
from app.tools.definitions import GOGGA_TOOLS, get_tools_for_tier, ToolCall
from app.plugins import LanguageDetectorPlugin, Plugin


def build_language_context(language_intel: dict | None) -> str | None:
    """
    Build language context injection for system prompts.
    
    Only returns context for non-English languages with confidence > 35%.
    
    Args:
        language_intel: Language detection results from plugin
        
    Returns:
        Language context string to append to system prompt, or None
    """
    if not language_intel:
        return None
    
    if language_intel.get("code") == "en":
        return None
    
    if language_intel.get("confidence", 0) <= 0.35:
        return None
    
    lang_name = language_intel.get("name", "Unknown")
    lang_code = language_intel.get("code", "en")
    confidence = language_intel.get("confidence", 0)
    is_hybrid = language_intel.get("is_hybrid", False)
    family = language_intel.get("family", "Unknown")
    
    if is_hybrid:
        return (
            f"\n\n[LANGUAGE INTELLIGENCE - MANDATORY]\n"
            f"Detected: {lang_name} ({lang_code}) with code-switching (confidence: {confidence:.0%})\n"
            f"Family: {family}\n"
            f"Strategy: Mirror the user's bilingual style. Use {lang_name} for greetings, "
            f"cultural expressions, and emphasis. Use English for technical terms.\n"
            f"[END LANGUAGE INTELLIGENCE]\n"
        )
    else:
        return (
            f"\n\n[LANGUAGE INTELLIGENCE - MANDATORY]\n"
            f"Detected: {lang_name} ({lang_code}) with {confidence:.0%} confidence\n"
            f"Family: {family}\n"
            f"Strategy: Respond primarily in {lang_name}. Use appropriate honorifics "
            f"and cultural markers. English technical terms are acceptable when no equivalent exists.\n"
            f"[END LANGUAGE INTELLIGENCE]\n"
        )


logger = logging.getLogger(__name__)

# Constants
MAX_HISTORY_TURNS: Final[int] = 10
DEFAULT_TEMPERATURE: Final[float] = 0.7
DEFAULT_MAX_TOKENS: Final[int] = 4096
DEFAULT_TOP_P: Final[float] = 0.95
# Note: JIGGA_MAX_TOKENS and JIGGA_DEFAULT_TOKENS imported from router.py

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

# Plugin system (lazy init)
_plugins: list[Plugin] | None = None


def get_client() -> Cerebras:
    """Get or create the Cerebras client instance."""
    global _client
    if _client is None:
        _client = Cerebras(api_key=settings.CEREBRAS_API_KEY)
    return _client


def get_plugins() -> list[Plugin]:
    """
    Get or create the plugin instances.
    
    Plugins run on EVERY request and CANNOT be disabled.
    They enrich context before LLM processing.
    """
    global _plugins
    if _plugins is None:
        _plugins = [
            LanguageDetectorPlugin(),  # MANDATORY: Language intelligence for SA languages
        ]
        logger.info(f"Initialized {len(_plugins)} plugins: {[p.name for p in _plugins]}")
    return _plugins


async def run_plugins_before_request(request: dict[str, Any]) -> dict[str, Any]:
    """
    Run all plugins' before_request hooks.
    
    Plugins process the request sequentially and can enrich metadata,
    modify messages, or add system prompts.
    
    Args:
        request: Chat completion request
        
    Returns:
        Modified request with plugin enrichments
    """
    plugins = get_plugins()
    
    for plugin in plugins:
        try:
            request = await plugin.before_request(request)
        except Exception as e:
            logger.error(f"Plugin {plugin.name} before_request error: {e}", exc_info=True)
            # Continue pipeline even if plugin fails
    
    return request


async def run_plugins_after_response(response: dict[str, Any]) -> dict[str, Any]:
    """
    Run all plugins' after_response hooks.
    
    Plugins can transform LLM output or add metadata.
    
    Args:
        response: LLM response
        
    Returns:
        Modified response with plugin transformations
    """
    plugins = get_plugins()
    
    for plugin in plugins:
        try:
            response = await plugin.after_response(response)
        except Exception as e:
            logger.error(f"Plugin {plugin.name} after_response error: {e}", exc_info=True)
            # Continue pipeline even if plugin fails
    
    return response


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
    
    SIMPLIFIED ARCHITECTURE (2025-01):
    
    FREE Tier:
        → OpenRouter Qwen 3 235B FREE
        
    JIVE Tier:
        → Cerebras Qwen 3 32B (thinking mode)
        
    JIGGA Tier:
        General → Cerebras Qwen 3 32B (thinking mode)
        Complex/Legal → Cerebras Qwen 3 235B (thinking mode)
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
        
        CRITICAL: This method runs plugins on EVERY request before LLM processing.
        Plugins CANNOT be disabled and enrich context with intelligence (language, etc.).
        
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
        # Build request object for plugins
        request = {
            "user_id": user_id,
            "message": message,
            "messages": [],  # Will be built by internal methods
            "history": history,
            "user_tier": user_tier.value,
            "metadata": {
                "original_message": message,
                "user_tier": user_tier.value,
                "context_tokens": context_tokens
            }
        }
        
        # Build messages for plugin processing
        if history:
            request["messages"].extend(history[-MAX_HISTORY_TURNS:])
        request["messages"].append({"role": "user", "content": message})
        
        # RUN PLUGINS: Enrich context with language intelligence (MANDATORY)
        request = await run_plugins_before_request(request)
        
        # Extract potentially modified message and history
        # Plugins may have added system prompts or modified content
        messages = request.get("messages", [])
        modified_history = [msg for msg in messages if msg.get("role") != "user"]
        
        # Use last user message in case plugin modified it
        last_user_msg = next(
            (msg["content"] for msg in reversed(messages) if msg.get("role") == "user"),
            message
        )
        
        # Determine which layer to use
        if force_layer:
            layer = force_layer
        else:
            layer = tier_router.classify_intent(last_user_msg, user_tier, context_tokens)
        
        # Extract language intelligence from plugin metadata for system prompt injection
        lang_intel = request.get("metadata", {}).get("language_intelligence", None)
        
        # SIMPLIFIED ROUTING (2025-01):
        # - FREE: OpenRouter
        # - JIVE/JIGGA: Cerebras Qwen (unified path)
        if layer == CognitiveLayer.FREE_TEXT:
            response = await AIService._generate_free(user_id, last_user_msg, modified_history or history, lang_intel)
        
        elif layer == CognitiveLayer.JIVE_TEXT:
            # JIVE tier: Qwen 32B with thinking mode
            response = await AIService._generate_cerebras(
                user_id, last_user_msg, modified_history or history, layer,
                thinking_mode=True,
                enable_tools=True,
                tier="jive",
                language_intel=lang_intel
            )
        
        elif layer == CognitiveLayer.JIVE_COMPLEX:
            # JIVE tier (complex/legal/extended): Qwen 235B with thinking mode
            response = await AIService._generate_cerebras(
                user_id, last_user_msg, modified_history or history, layer,
                thinking_mode=True,
                enable_tools=True,
                tier="jive",
                use_235b=True,  # Use 235B model for complex queries
                language_intel=lang_intel
            )
        
        elif layer == CognitiveLayer.JIGGA_THINK:
            # JIGGA tier (general): Qwen 32B with thinking mode
            response = await AIService._generate_cerebras(
                user_id, last_user_msg, modified_history or history, layer,
                thinking_mode=True,
                enable_tools=True,
                tier="jigga",
                language_intel=lang_intel
            )
        
        elif layer == CognitiveLayer.JIGGA_COMPLEX:
            # JIGGA tier (complex/legal): Qwen 235B with thinking mode
            response = await AIService._generate_cerebras(
                user_id, last_user_msg, modified_history or history, layer,
                thinking_mode=True,
                enable_tools=True,
                tier="jigga",
                use_235b=True,  # Use 235B model for complex queries
                language_intel=lang_intel
            )
        else:
            # Default fallback
            response = await AIService._generate_free(user_id, last_user_msg, modified_history or history, lang_intel)
        
        # Merge plugin metadata into response
        if "metadata" in request:
            if "meta" not in response:
                response["meta"] = {}
            response["meta"]["plugin_metadata"] = request["metadata"]
            
            # Promote language_intelligence to top level for easy frontend access
            if "language_intelligence" in request["metadata"]:
                lang_info = request["metadata"]["language_intelligence"]
                response["meta"]["detected_language"] = {
                    "code": lang_info.get("code", "en"),
                    "name": lang_info.get("name", "English"),
                    "confidence": lang_info.get("confidence", 0.0),
                    "is_hybrid": lang_info.get("is_hybrid", False),
                    "family": lang_info.get("family", "Germanic"),
                }
        
        # RUN PLUGINS: Post-process response (if needed)
        response = await run_plugins_after_response(response)
        
        return response
    
    @staticmethod
    async def _generate_free(
        user_id: str,
        message: str,
        history: list[MessageDict] | None,
        language_intel: dict | None = None
    ) -> ResponseDict:
        """
        FREE tier: OpenRouter Qwen 3 235B (free) with OptiLLM enhancements.
        
        Uses the same Qwen model family as paid tiers, just via OpenRouter.
        Applies light enhancements (re-read technique) to improve accuracy.
        
        Args:
            language_intel: Language detection results from plugin
        """
        from app.services.openrouter_service import openrouter_service
        
        system_prompt = tier_router.get_system_prompt(CognitiveLayer.FREE_TEXT)
        
        # INJECT LANGUAGE INTELLIGENCE into system prompt
        lang_context = build_language_context(language_intel)
        if lang_context:
            system_prompt = system_prompt + lang_context
            logger.info(f"FREE tier: Injected {language_intel.get('name')} language context into system prompt")
        
        # OPTILLM ENHANCEMENTS: Apply light enhancements for FREE tier
        enhancement_config = get_enhancement_config(tier="free", is_complex=False)
        
        # Apply system prompt enhancements (SPL reasoning strategies)
        if enhancement_config.level != EnhancementLevel.NONE:
            system_prompt = enhance_system_prompt(system_prompt, enhancement_config)
            logger.info(f"FREE tier OptiLLM enhancements: re2={enhancement_config.use_reread}")
        
        # Apply re-read enhancement to message (for non-trivial queries)
        enhanced_message = message
        if enhancement_config.use_reread and len(message) > 50:
            enhanced_message = enhance_user_message(message, enhancement_config)
        
        logger.info(
            f"FREE text | user={user_id} | prompt={message[:50]}..." if len(message) > 50 else f"FREE text | user={user_id} | prompt={message}"
        )
        
        return await openrouter_service.chat_free(
            message=enhanced_message,
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
        thinking_mode: bool = True,
        enable_tools: bool = False,
        tier: str = "jive",
        use_235b: bool = False,
        language_intel: dict | None = None
    ) -> ResponseDict:
        """
        JIVE/JIGGA tier: Cerebras Qwen models.

        SIMPLIFIED (2025-01):
        - JIVE: Qwen 32B with thinking mode
        - JIGGA: Qwen 32B (general) or 235B (complex/legal)

        Args:
            thinking_mode: Use Qwen thinking settings (always True now)
            enable_tools: Enable tool calling (JIVE: image+chart, JIGGA: all)
            tier: User tier for tool selection
            use_235b: Use Qwen 235B model for complex/legal queries
            language_intel: Language detection results from plugin (dict with code, name, confidence, etc.)

        Returns:
            ResponseDict with 'response', 'thinking' (if applicable), 'tool_calls', and 'meta'
        """
        config = tier_router.get_model_config(layer)
        model_id = config["model"]
        system_prompt = tier_router.get_system_prompt(layer)
        
        # INJECT LANGUAGE INTELLIGENCE into system prompt
        lang_context = build_language_context(language_intel)
        if lang_context:
            system_prompt = system_prompt + lang_context
            logger.info(f"Injected {language_intel.get('name')} language context into system prompt")

        # Override model for 235B queries
        if use_235b:
            model_id = settings.MODEL_JIGGA_235B
            logger.info(f"Using Qwen 235B for complex/legal query")

        # Check for document/analysis request - add comprehensive output instruction
        actual_message = message
        is_doc_request = is_document_analysis_request(message)
        is_extended_request = is_extended_output_request(message)
        
        # OPTILLM ENHANCEMENTS: Apply test-time compute optimizations
        # Determine if this is a complex query that benefits from full enhancements
        is_complex = use_235b or should_use_planning(message)
        enhancement_config = get_enhancement_config(
            tier=tier,
            is_complex=is_complex,
        )
        
        # Apply OptiLLM enhancements to system prompt
        if enhancement_config.level != EnhancementLevel.NONE:
            system_prompt = enhance_system_prompt(system_prompt, enhancement_config)
            logger.info(
                f"OptiLLM enhancements applied: level={enhancement_config.level.value}, "
                f"cot={enhancement_config.use_cot_reflection}, re2={enhancement_config.use_reread}, "
                f"planning={enhancement_config.use_planning}"
            )
        
        # Apply re-read enhancement to user message (if enabled)
        if enhancement_config.use_reread and len(message) > 50:  # Only for non-trivial queries
            actual_message = enhance_user_message(message, enhancement_config)
            logger.info("Re-read (re2) enhancement applied to message")

        if is_doc_request and thinking_mode:
            # Add comprehensive instruction for thinking mode
            actual_message = f"{actual_message}{COMPREHENSIVE_OUTPUT_INSTRUCTION}"
            logger.info("Document/analysis request detected - comprehensive output mode enabled")

        start_time = time.perf_counter()

        # Build messages
        messages: list[MessageDict] = [{"role": "system", "content": system_prompt}]
        if history:
            messages.extend(history[-MAX_HISTORY_TURNS:])
        messages.append({"role": "user", "content": actual_message})

        # UNIFIED QWEN SETTINGS:
        # All paid tiers now use Qwen with thinking mode
        # DO NOT use greedy decoding (temp=0) - causes performance degradation
        temperature = QWEN_THINKING_SETTINGS["temperature"]
        top_p = QWEN_THINKING_SETTINGS["top_p"]
        
        # Determine max_tokens based on request type and model
        if use_235b:
            # 235B supports up to 40k output tokens
            if is_extended_request or is_doc_request:
                max_tokens = JIGGA_235B_MAX_TOKENS  # 32000 for extended output
            else:
                max_tokens = QWEN_MAX_TOKENS  # 8000 for normal
        else:
            # 32B supports up to 8k output tokens
            if is_extended_request or is_doc_request:
                max_tokens = QWEN_MAX_TOKENS  # 8000 for extended output
            else:
                max_tokens = QWEN_DEFAULT_TOKENS  # 4096 for casual chat

        logger.info(f"{tier.upper()} thinking mode - model={model_id}, temp=0.6, top_p=0.95, max_tokens={max_tokens}")

        try:
            # === CEPO ROUTING (if enabled) ===
            # Route through CePO sidecar for enhanced 4-step reasoning + Best of N
            # Falls back to direct Cerebras API on failure
            if settings.CEPO_ENABLED and not enable_tools:  # CePO doesn't support tool calling yet
                try:
                    cepo_service = get_cepo_service()
                    cepo_config = CePoConfig(
                        bestofn_n=settings.CEPO_BESTOFN_N,
                        max_tokens=max_tokens,
                        timeout_seconds=settings.CEPO_TIMEOUT,
                    )
                    
                    logger.info(f"Routing {tier.upper()} request through CePO sidecar")
                    cepo_response = await cepo_service.generate_with_cepo(
                        model=model_id,
                        messages=messages,
                        temperature=temperature,
                        max_tokens=max_tokens,
                        config=cepo_config,
                    )
                    
                    # Parse CePO response (OpenAI format)
                    choice = cepo_response.get("choices", [{}])[0]
                    content = choice.get("message", {}).get("content", "")
                    usage = cepo_response.get("usage", {})
                    
                    elapsed = time.perf_counter() - start_time
                    logger.info(f"CePO response received in {elapsed:.2f}s")
                    
                    # Track usage and return response
                    await track_usage(
                        user_id=user_id,
                        tier=tier,
                        input_tokens=usage.get("prompt_tokens", 0),
                        output_tokens=usage.get("completion_tokens", 0),
                        model=model_id,
                    )
                    
                    return {
                        "response": content,
                        "thinking": None,  # CePO handles thinking internally
                        "tool_calls": [],
                        "meta": {
                            "model": model_id,
                            "layer": layer.value,
                            "provider": "cepo",
                            "latency_ms": int(elapsed * 1000),
                            "input_tokens": usage.get("prompt_tokens", 0),
                            "output_tokens": usage.get("completion_tokens", 0),
                            "cepo_metrics": cepo_service.get_metrics(),
                        }
                    }
                    
                except Exception as cepo_error:
                    # CePO failed - continue to standard Cerebras path (failsafe)
                    logger.warning(f"CePO routing failed, falling back to direct: {cepo_error}")
            
            # === STANDARD CEREBRAS PATH ===
            client = get_client()
            
            # Get tools for this tier (JIVE gets basic, JIGGA gets all, 235B gets delegate)
            tools = get_tools_for_tier(tier, model=model_id) if enable_tools else None

            # Retry loop with exponential backoff for rate limits
            last_error = None
            for attempt in range(MAX_RETRIES):
                try:
                    # Build API call kwargs
                    api_kwargs = {
                        "messages": messages,
                        "model": model_id,
                        "temperature": temperature,
                        "max_tokens": max_tokens,
                        "top_p": top_p,
                    }
                    
                    # Add tools if enabled
                    if tools:
                        api_kwargs["tools"] = tools
                        api_kwargs["parallel_tool_calls"] = False
                        logger.info(f"Tool calling enabled with {len(tools)} tools")
                    
                    response = await asyncio.to_thread(
                        client.chat.completions.create,
                        **api_kwargs
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
            choice = response.choices[0].message
            raw_content = choice.content or ""
            latency = time.perf_counter() - start_time
            
            # Check for tool calls in the response
            tool_calls_data = None
            if hasattr(choice, 'tool_calls') and choice.tool_calls:
                tool_calls_data = []
                for tc in choice.tool_calls:
                    import json
                    try:
                        args = json.loads(tc.function.arguments)
                    except json.JSONDecodeError:
                        args = {}
                    tool_calls_data.append({
                        "id": tc.id,
                        "name": tc.function.name,
                        "arguments": args
                    })
                logger.info(f"Tool calls detected: {[tc['name'] for tc in tool_calls_data]}")

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
                    "optillm_enhancements": {
                        "level": enhancement_config.level.value,
                        "cot_reflection": enhancement_config.use_cot_reflection,
                        "reread": enhancement_config.use_reread,
                        "planning": enhancement_config.use_planning,
                    },
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
            
            # Include tool calls if present (for frontend to execute)
            if tool_calls_data:
                result["tool_calls"] = tool_calls_data
                result["meta"]["has_tool_calls"] = True
                logger.info(f"Returning {len(tool_calls_data)} tool calls to frontend")

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
    async def _fallback_to_openrouter(
        user_id: str,
        message: str,
        history: list[MessageDict] | None,
        original_layer: CognitiveLayer,
        original_tier: str
    ) -> ResponseDict:
        """
        Fallback to OpenRouter when primary service is rate-limited.
        
        Uses the same Qwen 3 235B as FREE tier but tracks separately.
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
    async def generate_stream(
        user_id: str,
        message: str,
        history: list[MessageDict] | None,
        layer: CognitiveLayer,
        thinking_mode: bool = False,
        append_no_think: bool = False
    ):
        """
        JIVE/JIGGA tier: Cerebras streaming response.

        Yields chunks of the response as Server-Sent Events (SSE) format.

        Args:
            user_id: User identifier for tracking
            message: The user's message
            history: Previous conversation history
            layer: The cognitive layer (JIVE_DIRECT, JIGGA_THINK, etc.)
            thinking_mode: Use Qwen thinking settings (JIGGA)
            append_no_think: Append /no_think to message (JIGGA fast)

        Yields:
            SSE-formatted strings: "data: {json}\n\n"
        """
        import json
        
        config = tier_router.get_model_config(layer)
        model_id = config["model"]
        system_prompt = tier_router.get_system_prompt(layer)

        # Determine if this is JIGGA tier
        is_jigga = layer in (CognitiveLayer.JIGGA_THINK, CognitiveLayer.JIGGA_FAST)
        tier = "jigga" if is_jigga else "jive"

        # Check for document/analysis request
        actual_message = message
        is_doc_request = is_document_analysis_request(message)
        is_extended_request = is_extended_output_request(message)

        if is_doc_request and thinking_mode:
            actual_message = f"{message}{COMPREHENSIVE_OUTPUT_INSTRUCTION}"
            logger.info("Document/analysis request detected - comprehensive output mode enabled")

        # Append /no_think for JIGGA fast mode
        if append_no_think:
            actual_message = f"{actual_message} /no_think"
            logger.info("JIGGA fast mode - appending /no_think")

        start_time = time.perf_counter()

        # Build messages
        messages: list[MessageDict] = [{"role": "system", "content": system_prompt}]
        if history:
            messages.extend(history[-MAX_HISTORY_TURNS:])
        messages.append({"role": "user", "content": actual_message})

        # Set generation parameters based on tier and mode
        if is_jigga:
            if is_extended_request or is_doc_request:
                max_tokens = JIGGA_MAX_TOKENS
            else:
                max_tokens = JIGGA_DEFAULT_TOKENS
            
            if thinking_mode:
                temperature = QWEN_THINKING_SETTINGS["temperature"]
                top_p = QWEN_THINKING_SETTINGS["top_p"]
            else:
                temperature = QWEN_FAST_SETTINGS["temperature"]
                top_p = QWEN_FAST_SETTINGS["top_p"]
        else:
            # JIVE tier (Qwen 3 235B)
            temperature = DEFAULT_TEMPERATURE
            top_p = DEFAULT_TOP_P
            if is_extended_request or is_doc_request:
                max_tokens = JIVE_MAX_TOKENS
            else:
                max_tokens = JIVE_DEFAULT_TOKENS

        try:
            client = get_client()
            
            # Send initial metadata
            yield f"data: {json.dumps({'type': 'meta', 'tier': tier, 'layer': layer.value, 'model': model_id, 'thinking_mode': thinking_mode})}\n\n"

            # Create streaming response
            input_tokens = 0
            output_tokens = 0
            full_content = ""
            in_thinking = False
            thinking_buffer = ""
            
            # Use async iteration over sync stream via to_thread wrapper
            def create_stream():
                return client.chat.completions.create(
                    messages=messages,
                    model=model_id,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    top_p=top_p,
                    stream=True
                )
            
            stream = await asyncio.to_thread(create_stream)
            
            # Process stream chunks
            for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    content = chunk.choices[0].delta.content
                    full_content += content
                    
                    # Check for thinking tags in JIGGA mode
                    if thinking_mode:
                        # Detect start of thinking block
                        if "<think" in content.lower() and not in_thinking:
                            in_thinking = True
                            yield f"data: {json.dumps({'type': 'thinking_start'})}\n\n"
                        
                        # Detect end of thinking block
                        if "</think" in content.lower() and in_thinking:
                            in_thinking = False
                            yield f"data: {json.dumps({'type': 'thinking_end'})}\n\n"
                        
                        # Send content with appropriate type
                        if in_thinking:
                            yield f"data: {json.dumps({'type': 'thinking', 'content': content})}\n\n"
                        else:
                            yield f"data: {json.dumps({'type': 'content', 'content': content})}\n\n"
                    else:
                        yield f"data: {json.dumps({'type': 'content', 'content': content})}\n\n"
                
                # Track usage from final chunk
                if hasattr(chunk, 'usage') and chunk.usage:
                    input_tokens = chunk.usage.prompt_tokens
                    output_tokens = chunk.usage.completion_tokens

            latency = time.perf_counter() - start_time

            # Parse thinking for accurate content separation
            main_response, thinking_block = parse_thinking_response(full_content)

            # Track usage with tier for proper pricing
            cost_data = await track_usage(
                user_id=user_id,
                model=model_id,
                layer=layer.value,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                tier=tier
            )

            logger.info(
                "Cerebras stream complete | tier=%s | layer=%s | latency=%.2fs | tokens=%d/%d",
                tier, layer.value, latency, input_tokens, output_tokens
            )

            # Send final metadata
            final_meta = {
                "type": "done",
                "meta": {
                    "tier": tier,
                    "layer": layer.value,
                    "model": model_id,
                    "provider": "cerebras",
                    "thinking_mode": thinking_mode,
                    "no_think": append_no_think,
                    "latency_seconds": round(latency, 3),
                    "tokens": {
                        "input": input_tokens,
                        "output": output_tokens
                    },
                    "cost_usd": cost_data["usd"],
                    "cost_zar": cost_data["zar"],
                    "has_thinking": thinking_block is not None
                }
            }
            yield f"data: {json.dumps(final_meta)}\n\n"

        except Exception as e:
            error_str = str(e)
            logger.error("GOGGA streaming error: %s", error_str)
            
            error_response = {
                "type": "error",
                "error": "GOGGA AI encountered an issue. Please try again."
            }
            yield f"data: {json.dumps(error_response)}\n\n"

    @staticmethod
    async def generate_response_with_tools_stream(
        user_id: str,
        message: str,
        history: list[MessageDict] | None,
        layer: CognitiveLayer,
        thinking_mode: bool = False,
        append_no_think: bool = False,
        tier: str = "jive",
        force_tool: str | None = None,  # ToolShed: Force specific tool by name
    ):
        """
        Generate response with streaming tool execution logs.
        
        Yields SSE events:
        - tool_start: Math tool execution starting
        - tool_log: Execution progress log
        - tool_complete: Tool finished
        - content: Response text chunks
        - done: Final metadata (includes detected_language)
        """
        import json
        import time
        from app.tools.executor import execute_math_tool
        from app.tools.definitions import get_tools_for_tier
        from app.tools.math_definitions import ALL_MATH_TOOL_NAMES
        from app.tools.search_executor import execute_search_tool, ALL_SEARCH_TOOL_NAMES
        
        config = tier_router.get_model_config(layer)
        model_id = config["model"]
        system_prompt = tier_router.get_system_prompt(layer)
        
        # RUN LANGUAGE DETECTION PLUGIN (streaming path)
        # Build request dict for plugin processing
        request = {"messages": [], "metadata": {}}
        if history:
            request["messages"].extend(history[-MAX_HISTORY_TURNS:])
        request["messages"].append({"role": "user", "content": message})
        
        # Run language detection
        request = await run_plugins_before_request(request)
        lang_intel = request.get("metadata", {}).get("language_intelligence", None)
        
        # Inject language context into system prompt
        lang_context = build_language_context(lang_intel)
        if lang_context:
            system_prompt = system_prompt + lang_context
            logger.info(f"Streaming: Injected {lang_intel.get('name')} language context into system prompt")
        
        # ToolShed: Add force tool instruction if specified
        if force_tool:
            system_prompt += f"\n\n**USER HAS REQUESTED SPECIFIC TOOL**\nThe user wants you to use the `{force_tool}` tool for this request. You MUST call this tool with appropriate parameters based on their message. Do not skip the tool call."
            logger.info(f"[ToolShed] Forcing tool: {force_tool}")
        
        # Send initial metadata (include detected_language)
        initial_meta = {'type': 'meta', 'tier': tier, 'layer': layer.value, 'model': model_id, 'force_tool': force_tool}
        if lang_intel:
            initial_meta['detected_language'] = {
                "code": lang_intel.get("code", "en"),
                "name": lang_intel.get("name", "English"),
                "confidence": lang_intel.get("confidence", 0.0),
                "is_hybrid": lang_intel.get("is_hybrid", False),
                "family": lang_intel.get("family", "Germanic"),
            }
        yield f"data: {json.dumps(initial_meta)}\n\n"
        
        start_time = time.perf_counter()
        
        # Build messages
        messages: list[MessageDict] = [{"role": "system", "content": system_prompt}]
        if history:
            messages.extend(history[-MAX_HISTORY_TURNS:])
        messages.append({"role": "user", "content": message})
        
        # First LLM call - check for tool calls
        client = get_client()
        tools = get_tools_for_tier(tier, model=model_id)  # Pass model for 235B detection
        
        # Store lang_intel for done event
        detected_language_for_done = None
        if lang_intel:
            detected_language_for_done = {
                "code": lang_intel.get("code", "en"),
                "name": lang_intel.get("name", "English"),
                "confidence": lang_intel.get("confidence", 0.0),
                "is_hybrid": lang_intel.get("is_hybrid", False),
                "family": lang_intel.get("family", "Germanic"),
            }
        
        try:
            response = await asyncio.to_thread(
                client.chat.completions.create,
                model=model_id,
                messages=messages,
                tools=tools if tools else None,
                temperature=config.get("temperature", 0.6),
                top_p=config.get("top_p", 0.95),
                max_completion_tokens=config.get("max_tokens", 4096)
            )
            
            choice = response.choices[0].message
            assistant_content = choice.content or ""
            
            # Check for server-side tool calls (math + search)
            math_tool_calls = []
            search_tool_calls = []
            other_tool_calls = []
            
            if hasattr(choice, 'tool_calls') and choice.tool_calls:
                for tc in choice.tool_calls:
                    try:
                        args = json.loads(tc.function.arguments)
                    except json.JSONDecodeError:
                        args = {}
                    tool_data = {
                        "id": tc.id,
                        "name": tc.function.name,
                        "arguments": args
                    }
                    if tc.function.name in ALL_MATH_TOOL_NAMES:
                        math_tool_calls.append(tool_data)
                    elif tc.function.name in ALL_SEARCH_TOOL_NAMES:
                        search_tool_calls.append(tool_data)
                    else:
                        other_tool_calls.append(tool_data)
            
            # Process search tools first (AI should pause and wait for results)
            search_results = []
            if search_tool_calls:
                yield f"data: {json.dumps({'type': 'tool_start', 'tools': [tc['name'] for tc in search_tool_calls], 'tool_type': 'search'})}\n\n"
                
                for tc in search_tool_calls:
                    tool_name = tc["name"]
                    args = tc["arguments"]
                    
                    query_preview = args.get("query", "")[:50]
                    search_log = {'type': 'tool_log', 'level': 'info', 'message': f'[>] Searching: {query_preview}...', 'icon': 'search'}
                    yield f"data: {json.dumps(search_log)}\n\n"
                    
                    try:
                        result = await execute_search_tool(tool_name, args)
                        
                        if result.get("success"):
                            count = result.get("results_count", result.get("places_count", 0))
                            time_ms = result.get("search_time_ms", 0)
                            success_log = {'type': 'tool_log', 'level': 'success', 'message': f'[+] Found {count} results in {time_ms}ms', 'icon': 'check'}
                            yield f"data: {json.dumps(success_log)}\n\n"
                        else:
                            error_msg = result.get("error", "Unknown error")
                            warn_log = {'type': 'tool_log', 'level': 'warning', 'message': f'[!] Search partial: {error_msg}', 'icon': 'warning'}
                            yield f"data: {json.dumps(warn_log)}\n\n"
                        
                        search_results.append({
                            "tool_call_id": tc["id"],
                            "role": "tool",
                            "name": tool_name,
                            "content": result.get("context", json.dumps(result))
                        })
                        
                    except Exception as e:
                        logger.error(f"Search tool {tool_name} failed: {e}")
                        error_log = {'type': 'tool_log', 'level': 'error', 'message': f'[!] Search failed: {str(e)}', 'icon': 'error'}
                        yield f"data: {json.dumps(error_log)}\n\n"
                        search_results.append({
                            "tool_call_id": tc["id"],
                            "role": "tool",
                            "name": tool_name,
                            "content": f"[Search failed: {str(e)}]"
                        })
                
                yield f"data: {json.dumps({'type': 'tool_complete', 'count': len(search_tool_calls), 'tool_type': 'search'})}\n\n"
            
            # If we have search results, continue with a second LLM call
            if search_results:
                # Build continuation messages with search context
                extended_messages = list(messages)
                
                # Add assistant message with tool calls
                assistant_msg = {"role": "assistant", "content": assistant_content or ""}
                assistant_msg["tool_calls"] = [
                    {"id": tc["id"], "type": "function", "function": {"name": tc["name"], "arguments": json.dumps(tc["arguments"])}}
                    for tc in search_tool_calls
                ]
                extended_messages.append(assistant_msg)
                
                # Add tool results
                for sr in search_results:
                    extended_messages.append(sr)
                
                yield f"data: {json.dumps({'type': 'tool_log', 'level': 'info', 'message': '[>] Processing search results...', 'icon': 'ai'})}\n\n"
                
                # Second LLM call with search context
                second_response = await asyncio.to_thread(
                    client.chat.completions.create,
                    model=model_id,
                    messages=extended_messages,
                    tools=tools if tools else None,
                    temperature=config.get("temperature", 0.6),
                    top_p=config.get("top_p", 0.95),
                    max_completion_tokens=config.get("max_tokens", 4096)
                )
                
                # Update for next phase
                choice = second_response.choices[0].message
                assistant_content = choice.content or ""
                response = second_response  # Update for usage tracking
                
                # Check for additional tool calls (math, charts, etc.)
                math_tool_calls = []
                other_tool_calls = []
                if hasattr(choice, 'tool_calls') and choice.tool_calls:
                    for tc in choice.tool_calls:
                        try:
                            args = json.loads(tc.function.arguments)
                        except json.JSONDecodeError:
                            args = {}
                        tool_data = {
                            "id": tc.id,
                            "name": tc.function.name,
                            "arguments": args
                        }
                        if tc.function.name in ALL_MATH_TOOL_NAMES:
                            math_tool_calls.append(tool_data)
                        elif tc.function.name not in ALL_SEARCH_TOOL_NAMES:
                            other_tool_calls.append(tool_data)
            
            # If no math tools, just stream the content
            if not math_tool_calls:
                if assistant_content:
                    yield f"data: {json.dumps({'type': 'content', 'content': assistant_content})}\n\n"
                
                # Send done event with any other tool calls (charts, images, etc.)
                latency = time.perf_counter() - start_time
                usage = response.usage
                cost_data = await track_usage(
                    user_id=user_id,
                    model=model_id,
                    layer=layer.value,
                    input_tokens=usage.prompt_tokens,
                    output_tokens=usage.completion_tokens,
                    tier=tier
                )
                done_data = {
                    'type': 'done', 
                    'latency': round(latency, 3), 
                    'tokens': {'input': usage.prompt_tokens, 'output': usage.completion_tokens}, 
                    'cost_zar': cost_data['zar']
                }
                # Include non-math tool calls for frontend execution (charts, images)
                if other_tool_calls:
                    done_data['tool_calls'] = [{
                        'function': {'name': tc['name'], 'arguments': tc['arguments']},
                        'id': tc['id']
                    } for tc in other_tool_calls]
                # Include detected language for frontend display
                if detected_language_for_done:
                    done_data['detected_language'] = detected_language_for_done
                yield f"data: {json.dumps(done_data)}\n\n"
                return
            
            # MATH TOOL EXECUTION - Stream execution logs
            yield f"data: {json.dumps({'type': 'tool_start', 'tools': [tc['name'] for tc in math_tool_calls]})}\n\n"
            
            tool_results = []
            for tc in math_tool_calls:
                tool_name = tc["name"]
                args = tc["arguments"]
                
                # Log: Starting tool
                yield f"data: {json.dumps({'type': 'tool_log', 'level': 'info', 'message': f'[>] Starting {tool_name}...', 'icon': 'wrench'})}\n\n"
                
                # Log: Arguments
                args_summary = ", ".join([f"{k}={v}" for k, v in list(args.items())[:5]])
                yield f"data: {json.dumps({'type': 'tool_log', 'level': 'debug', 'message': f'Args: {args_summary}', 'icon': '•'})}\n\n"
                
                try:
                    # Execute the tool
                    yield f"data: {json.dumps({'type': 'tool_log', 'level': 'info', 'message': '[~] Executing calculation...', 'icon': 'calc'})}\n\n"
                    
                    result = await execute_math_tool(
                        tool_name=tool_name,
                        arguments=args,
                        tier=tier
                    )
                    
                    # Convert result
                    if hasattr(result, '__dict__') and not isinstance(result, dict):
                        result_dict = dict(result) if hasattr(result, 'keys') else vars(result)
                    else:
                        result_dict = result
                    
                    # Log: Success
                    yield f"data: {json.dumps({'type': 'tool_log', 'level': 'success', 'message': f'[+] {tool_name} completed', 'icon': 'check'})}\n\n"
                    
                    tool_results.append({
                        "tool_call_id": tc["id"],
                        "role": "tool",
                        "name": tool_name,
                        "content": json.dumps(result_dict, default=str)
                    })
                    
                except Exception as e:
                    yield f"data: {json.dumps({'type': 'tool_log', 'level': 'error', 'message': f'[!] {tool_name} failed: {str(e)}', 'icon': 'error'})}\n\n"
                    tool_results.append({
                        "tool_call_id": tc["id"],
                        "role": "tool",
                        "name": tool_name,
                        "content": json.dumps({"success": False, "error": str(e)})
                    })
            
            yield f"data: {json.dumps({'type': 'tool_complete', 'count': len(math_tool_calls)})}\n\n"
            
            # Build continuation messages
            extended_history = list(history or [])
            extended_history.append({"role": "user", "content": message})
            
            assistant_msg = {"role": "assistant", "content": assistant_content or ""}
            assistant_msg["tool_calls"] = [
                {"id": tc["id"], "type": "function", "function": {"name": tc["name"], "arguments": json.dumps(tc["arguments"])}}
                for tc in math_tool_calls
            ]
            extended_history.append(assistant_msg)
            
            for tr in tool_results:
                extended_history.append(tr)
            
            # Log: Sending to LLM
            yield f"data: {json.dumps({'type': 'tool_log', 'level': 'info', 'message': '[>] Sending results to AI...', 'icon': 'ai'})}\n\n"
            
            # Second LLM call - get final response (streaming)
            # Include non-math tools (charts, images) so AI can call them after processing results
            non_math_tools = [t for t in (tools or []) if t.get("function", {}).get("name", "") not in ALL_MATH_TOOL_NAMES]
            final_messages = [{"role": "system", "content": system_prompt}] + extended_history
            
            def create_stream():
                api_kwargs = {
                    "model": model_id,
                    "messages": final_messages,
                    "temperature": config.get("temperature", 0.6),
                    "top_p": config.get("top_p", 0.95),
                    "max_completion_tokens": config.get("max_tokens", 4096),
                    "stream": True
                }
                # Include chart/image tools for second pass
                if non_math_tools:
                    api_kwargs["tools"] = non_math_tools
                return client.chat.completions.create(**api_kwargs)
            
            # Use non-streaming for second call to capture tool calls properly
            final_api_kwargs = {
                "model": model_id,
                "messages": final_messages,
                "temperature": config.get("temperature", 0.6),
                "top_p": config.get("top_p", 0.95),
                "max_completion_tokens": config.get("max_tokens", 4096)
            }
            # Include chart/image tools for second pass
            if non_math_tools:
                final_api_kwargs["tools"] = non_math_tools
                logger.info(f"Second LLM call with {len(non_math_tools)} non-math tools")
            
            final_response = await asyncio.to_thread(
                client.chat.completions.create,
                **final_api_kwargs
            )
            
            final_choice = final_response.choices[0].message
            final_content = final_choice.content or ""
            
            # Stream the final content in chunks for UX
            chunk_size = 50
            for i in range(0, len(final_content), chunk_size):
                chunk = final_content[i:i+chunk_size]
                yield f"data: {json.dumps({'type': 'content', 'content': chunk})}\n\n"
            
            # Capture any tool calls from the second response (charts, images)
            second_pass_tools = []
            if hasattr(final_choice, 'tool_calls') and final_choice.tool_calls:
                for tc in final_choice.tool_calls:
                    try:
                        args = json.loads(tc.function.arguments)
                    except json.JSONDecodeError:
                        args = {}
                    second_pass_tools.append({
                        "id": tc.id,
                        "name": tc.function.name,
                        "arguments": args
                    })
                logger.info(f"Second pass tool calls: {[tc['name'] for tc in second_pass_tools]}")
            
            # Combine any tool calls from first pass (other_tool_calls) with second pass
            all_frontend_tools = other_tool_calls + second_pass_tools
            
            # Final done event
            latency = time.perf_counter() - start_time
            total_input = response.usage.prompt_tokens + final_response.usage.prompt_tokens
            output_tokens = final_response.usage.completion_tokens
            cost_data = await track_usage(
                user_id=user_id,
                model=model_id,
                layer=layer.value,
                input_tokens=total_input,
                output_tokens=output_tokens,
                tier=tier
            )
            
            done_data = {
                'type': 'done', 
                'latency': round(latency, 3), 
                'math_tools_executed': [tc['name'] for tc in math_tool_calls], 
                'math_tool_count': len(math_tool_calls), 
                'cost_zar': cost_data['zar']
            }
            # Include all frontend tool calls (charts, images from either pass)
            if all_frontend_tools:
                done_data['tool_calls'] = [{
                    'function': {'name': tc['name'], 'arguments': tc['arguments']},
                    'id': tc['id']
                } for tc in all_frontend_tools]
                logger.info(f"Returning {len(all_frontend_tools)} tool calls to frontend: {[tc['name'] for tc in all_frontend_tools]}")
            # Include detected language for frontend display
            if detected_language_for_done:
                done_data['detected_language'] = detected_language_for_done
            yield f"data: {json.dumps(done_data)}\n\n"
            
        except Exception as e:
            logger.error(f"Streaming with tools failed: {e}")
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    @staticmethod
    async def health_check() -> ResponseDict:
        """Check Cerebras connection health (lightweight - no API call)."""
        try:
            # Just verify client can be created - don't waste API calls
            # Actual health is verified on real requests
            client = get_client()
            
            # Check client is configured correctly
            if client is not None:
                return {
                    "status": "healthy",
                    "provider": "cerebras",
                    "note": "Client initialized (no test call to preserve rate limit)"
                }
            else:
                return {
                    "status": "unhealthy",
                    "error": "Client not initialized"
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
