"""
GOGGA Tier-Based Cognitive Router

Routes requests based on user subscription tier:
- FREE: OpenRouter Llama 3.3 70B (text) + Pollinations.ai (images)
- JIVE: Cerebras Qwen 3 32B (text) + FLUX 1.1 Pro (images, capped)
- JIGGA: Cerebras Qwen 3 32B/235B (text) + FLUX 1.1 Pro (images, higher cap)

Universal across all tiers:
- Prompt Enhancement: OpenRouter Llama 3.3 70B FREE

SIMPLIFIED ARCHITECTURE (2025-01):
- Removed CePO/OptiLLM sidecar (optillm enhancements handled differently)
- JIVE and JIGGA both use Qwen models (unified streaming path)
- FREE tier uses OpenRouter only
"""
from enum import Enum
from functools import lru_cache
from typing import Final, TypedDict
import sys

from app.models.domain import ChatRequest

from app.config import settings

# Python 3.14: Enable JIT compiler for hot path optimization (20-40% faster)
if sys.version_info >= (3, 14) and hasattr(sys, '_experimental_jit'):
    sys._experimental_jit = 1  # Enable tier 1 JIT for routing hot paths


class UserTier(str, Enum):
    """User subscription tiers."""
    FREE = "free"      # OpenRouter FREE models only
    JIVE = "jive"      # Cerebras Qwen 32B, FLUX capped
    JIGGA = "jigga"    # Cerebras Qwen 32B/235B, FLUX higher cap


class CognitiveLayer(str, Enum):
    """Enumeration of available cognitive layers."""
    # FREE tier layers (OpenRouter)
    FREE_TEXT = "free_text"              # Llama 3.3 70B FREE (OpenRouter)
    FREE_IMAGE = "free_image"            # Pollinations.ai (FREE)
    
    # JIVE tier layers (Cerebras Qwen 32B)
    JIVE_TEXT = "jive_text"              # Qwen 3 32B (general chat)
    JIVE_IMAGE = "jive_image"            # FLUX 1.1 Pro (capped)
    
    # JIGGA tier layers (Cerebras Qwen 32B/235B)
    JIGGA_THINK = "jigga_think"          # Qwen 3 32B with thinking (temp=0.6, top_p=0.95)
    JIGGA_COMPLEX = "jigga_complex"      # Qwen 3 235B for complex/legal (thinking mode)
    JIGGA_IMAGE = "jigga_image"          # FLUX 1.1 Pro (higher cap)
    
    # Universal layers
    ENHANCE_PROMPT = "enhance_prompt"    # Llama 3.3 70B FREE (all tiers)
    MULTIMODAL = "multimodal"            # Google Live API (TODO)


class RouteConfig(TypedDict):
    """Structured routing configuration for tier-based requests."""

    service: str
    model: str
    reasoning: bool
    think_mode: bool
    no_think: bool


# Image generation limits per tier (per month)
IMAGE_LIMITS: Final[dict[UserTier, int]] = {
    UserTier.FREE: 50,      # 50 Pollinations images/month
    UserTier.JIVE: 200,     # 200 FLUX images/month
    UserTier.JIGGA: 1000,   # 1000 FLUX images/month
}


# Qwen thinking mode settings (all paid tiers now use Qwen)
# Token limits - unified for JIVE and JIGGA
# NOTE: Qwen 32B supports up to 8,000 output tokens, Qwen 235B supports up to 40,000
QWEN_MAX_TOKENS: Final[int] = 8000  # Qwen 32B max output
QWEN_DEFAULT_TOKENS: Final[int] = 4096  # Default for normal requests

# JIGGA 235B Token limits (complex/legal)
JIGGA_235B_MAX_TOKENS: Final[int] = 32000  # Qwen 235B extended output (max: 40,000)

# JIGGA Token limits (Qwen 3 32B)
# Context: 65k tokens (free) / 131k (paid) | Max Output: 8k tokens
# Since JIGGA always uses thinking mode (removed /no_think), default to max output
# This prevents truncation on analysis and document processing
JIGGA_MAX_TOKENS: Final[int] = 8000  # Qwen 3 32B max output
JIGGA_DEFAULT_TOKENS: Final[int] = 8000  # Always use max for JIGGA tier

# DO NOT use greedy decoding (temp=0) - causes performance degradation and endless repetitions
# For long contexts (>100k tokens), use /no_think to disable reasoning and save context budget
QWEN_THINKING_SETTINGS: Final[dict] = {
    "temperature": 0.6,  # REQUIRED - greedy (0) causes infinite loops
    "top_p": 0.95,
    "top_k": 20,
    "min_p": 0.0,
    # max_tokens set dynamically based on request type (4096 default, 8000 extended)
}

# Qwen fast mode settings (JIGGA tier with /no_think)
# Use for: casual chat, quick questions, or long contexts where thinking would exceed budget
QWEN_FAST_SETTINGS: Final[dict] = {
    "temperature": 0.7,
    "top_p": 0.8,
    "top_k": 20,
    "min_p": 0.0,
    # max_tokens set dynamically based on request type (4096 default, 8000 extended)
}


# Keywords that trigger extended output (8000 tokens for JIVE, 8000+ for JIGGA)
# These explicitly request long-form, detailed output
EXTENDED_OUTPUT_KEYWORDS: Final[frozenset[str]] = frozenset([
    # Explicit length requests
    "long format", "extended format", "detailed format",
    "add more words", "more detail", "more details",
    "elaborate more", "expand on this", "go deeper",
    "full explanation", "thorough explanation", "complete explanation",
    "in depth", "in-depth", "extensively",
    
    # Document length indicators
    "at least 1000 words", "at least 2000 words", "at least 3000 words",
    "minimum 1000", "minimum 2000", "minimum 3000",
    "very detailed", "extremely detailed", "highly detailed",
    
    # Professional output requests
    "comprehensive report", "detailed report", "full report",
    "comprehensive analysis", "detailed analysis", "full analysis",
    "comprehensive review", "detailed review", "full review",
    "comprehensive breakdown", "detailed breakdown", "full breakdown",
    "draft a full", "write a full", "create a full",
    "thorough review", "thorough analysis", "thorough explanation",
    "extended analysis", "extended review", "extended report",
])

# Keywords that trigger comprehensive document/analysis output
# IMPORTANT: Only use EXPLICIT document request phrases to avoid false positives
# Single words like "paper", "doc", "formal" are too generic and trigger on casual chat
DOCUMENT_ANALYSIS_KEYWORDS: Final[frozenset[str]] = frozenset([
    # Explicit document creation requests (multi-word to reduce false positives)
    "write me a report", "create a report", "draft a report", "prepare a report",
    "write me a document", "create a document", "draft a document",
    "write me an analysis", "create an analysis", "provide an analysis",
    "write me a proposal", "create a proposal", "draft a proposal",
    "write me a memo", "create a memo", "draft a memo",
    "write me a brief", "create a brief", "prepare a brief",
    
    # Explicit professional document types (multi-word only)
    "business case", "white paper", "research paper", "legal opinion",
    "legal analysis", "case study", "contract review", "compliance report",
    "due diligence report", "technical specification", "architecture document",
    "design document", "requirements document", "feasibility study",
    "market analysis", "swot analysis", "risk assessment",
    "business plan", "marketing plan", "strategic plan", "project plan",
    "implementation plan", "action plan",
    
    # Explicit format requests
    "give me a detailed report", "provide a comprehensive analysis",
    "i need a formal document", "write this formally", "make it formal",
    "executive summary format", "structured analysis",
])


# Keywords that trigger 235B model for complex reasoning (JIGGA tier)
# These require deep analysis where 235B's superior reasoning matters
COMPLEX_235B_KEYWORDS: Final[frozenset[str]] = frozenset([
    # Deep analysis requests (multi-word)
    "analyze deeply", "comprehensive analysis", "thorough review",
    "examine carefully", "deep dive", "full assessment",
    
    # Legal reasoning - single keywords (235B has better legal comprehension)
    "constitutional", "precedent", "statutory", "litigation",
    "tribunal", "advocate", "attorney", "indemnity", "compliance",
    
    # SA legal acts and regulations (single words with word boundary matching)
    "popia", "gdpr", "fica", "rica", "sars", "bbbee", "b-bbee",
    
    # Legal multi-word phrases
    "legal implications", "case analysis", "constitutional analysis",
    "statutory interpretation", "consumer protection", "rental housing",
    "labour relations", "employment law",
    
    # Complex coding/architecture
    "system design", "architecture review", "refactor entire",
    "performance optimization", "security audit",
    
    # Research tasks
    "research thoroughly", "investigate thoroughly", "evaluate all options",
])

# Keywords that trigger thinking mode (JIVE and JIGGA default)
THINKING_KEYWORDS: Final[frozenset[str]] = frozenset([
    # Deep analysis
    "analyze deeply", "comprehensive analysis", "thorough review",
    "examine carefully", "deep dive", "full assessment",
    
    # Legal reasoning
    "legal implications", "case analysis", "precedent",
    "constitutional analysis", "statutory interpretation",
    
    # Complex coding
    "system design", "architecture review", "refactor entire",
    "performance optimization", "security audit",
    
    # Research
    "research thoroughly", "investigate", "evaluate all options",
])

# Image intent keywords
IMAGE_KEYWORDS: Final[frozenset[str]] = frozenset([
    # Explicit image generation requests - must be specific to avoid false positives
    "draw me", "draw a", "draw an", "draw the",
    "create an image", "create a picture", "create artwork",
    "make a picture", "make an image", "make me a",
    "generate an image", "generate a picture", "generate artwork",
    "design a logo", "design me a", "design a",
    "render a", "render an", "render the",
    "sketch a", "sketch me", "sketch the",
    "paint a", "paint me", "paint the",
    # Specific image types - with context words
    "illustration of", "logo for", "artwork of", "art of",
    "picture of", "image of", "photo of", "photograph of",
    "portrait of", "landscape of", "scene of",
    # Direct requests
    "visualize this", "show me a picture", "can you draw",
])

# South African Bantu language indicators
# These trigger 235B model for better multilingual support
# The 235B Instruct model has "powerful multilingual capabilities" (Cerebras docs)
SA_BANTU_LANGUAGE_PATTERNS: Final[frozenset[str]] = frozenset([
    # Language names (when user mentions them)
    "isizulu", "zulu", "isixhosa", "xhosa", "sesotho", "sotho", 
    "setswana", "tswana", "sepedi", "pedi", "northern sotho",
    "isindebele", "ndebele", "siswati", "swati", "swazi",
    "tshivenda", "venda", "xitsonga", "tsonga",
    
    # Common Zulu words/phrases
    "sawubona", "yebo", "ngiyabonga", "unjani", "ngiyaphila",
    "umuntu", "abantu", "ubuntu", "inkosi", "indaba",
    "isibongo", "igama", "umsebenzi", "uthando", "amandla",
    
    # Common Xhosa words/phrases  
    "molo", "enkosi", "uxolo", "camagu", "ewe", "hayi",
    "umntu", "ukutya", "umzi", "intombi", "inkwenkwe",
    
    # Common Sotho/Tswana words/phrases
    "dumela", "kea leboha", "ke a leboga", "re a leboga",
    "motho", "batho", "ntate", "mme", "ngwana", "mosadi",
    "monna", "kgosi", "morena", "thuto", "bophelo",
    
    # Common Venda/Tsonga words
    "ndaa", "ndi a livhuwa", "ndo livhuwa", "ahee",
    "munhu", "vhathu", "mufunzi", "khosi",
    
    # SA context that often involves African languages
    "ka sesotho", "ka isizulu", "ka isixhosa", "ngesi",
    "translate to zulu", "translate to xhosa", "translate to sotho",
    "in zulu", "in xhosa", "in sotho", "in tswana",
])


def contains_african_language(message: str) -> bool:
    """
    Detect if message contains South African Bantu language content.
    This triggers the 235B model for better multilingual handling.
    
    The Qwen 3 235B Instruct model has "powerful multilingual capabilities"
    and is better suited for African language content than the 32B model.
    """
    message_lower = message.lower()
    return any(pattern in message_lower for pattern in SA_BANTU_LANGUAGE_PATTERNS)


def is_image_prompt(prompt: str) -> bool:
    """
    Detect if a prompt is requesting image generation.
    
    Only checks the first 200 characters of the message to avoid false positives
    when RAG context or document content contains image-related words.
    """
    # Only check the beginning of the message, not full RAG context
    prompt_start = prompt[:200].lower()
    return any(keyword in prompt_start for keyword in IMAGE_KEYWORDS)


def is_extended_output_request(message: str) -> bool:
    """
    Detect if user is requesting extended/long-form output.
    Triggers 8000 token max for JIVE tier.
    """
    message_lower = message.lower()
    return any(keyword in message_lower for keyword in EXTENDED_OUTPUT_KEYWORDS)


def is_document_analysis_request(message: str) -> bool:
    """
    Detect if user is requesting a document, analysis, report, or professional output.
    These requests should trigger comprehensive, structured, verbose output.
    """
    message_lower = message.lower()
    return any(keyword in message_lower for keyword in DOCUMENT_ANALYSIS_KEYWORDS)


# Comprehensive output format instruction for document/analysis requests
# This is appended to the user's message when document analysis is detected
# IMPORTANT: Preserve GOGGA personality - formal structure but SA voice
COMPREHENSIVE_OUTPUT_INSTRUCTION: Final[str] = """

---
[SYSTEM: Formal Document Requested]

The user has explicitly requested a formal document, report, or analysis.
Provide well-structured, comprehensive output BUT maintain your GOGGA personality:
- Keep your SA voice and context (Rands, local references, etc.)
- You can still be warm and helpful, just more structured
- Use clear headings and sections appropriate to the document type
- Be thorough but don't lose your personality
- User's explicit format requests ALWAYS override these defaults

If the user asks for something "brief" or "quick" - give them that instead.
---
"""


def should_use_thinking(message: str, context_tokens: int = 0) -> bool:
    """
    Determine if JIGGA tier should use thinking mode.
    
    NOTE: As of 2025-12-07, JIGGA always uses thinking mode for better quality.
    This function is kept for backwards compatibility but always returns True.
    The /no_think feature was removed due to poor output quality for
    analysis and long document processing.
    """
    # Always use thinking mode for JIGGA tier
    # Previous fast mode logic has been removed for better output quality
    _ = message, context_tokens  # Suppress unused parameter warnings
    return True


def _extract_keywords(message: str) -> set[str]:
    """Lightweight keyword extraction for routing decisions.
    
    Supports both single-word and multi-word keyword matching.
    Multi-word phrases are matched by checking if they exist as substrings
    in the lowercased message.
    """
    lowered = message.lower()
    
    # Single-word tokens for simple matching
    tokens = {token.strip(".,!?;:") for token in lowered.split()}
    tokens = {token for token in tokens if token}
    
    # For multi-word keywords, we check if they appear in the message
    # This is done in the caller by also checking substring matches
    return tokens


def _matches_complex_keywords(message: str) -> bool:
    """Check if message matches any COMPLEX_235B_KEYWORDS (word-boundary aware).
    
    Uses word boundary matching to avoid false positives like:
    - 'rica' matching 'Africa'
    - 'act' matching 'practical'
    """
    import re
    lowered = message.lower()
    
    # Check each keyword with word boundaries
    for keyword in COMPLEX_235B_KEYWORDS:
        # Multi-word keywords: check as substring (already unique enough)
        if " " in keyword:
            if keyword in lowered:
                return True
        else:
            # Single-word: use word boundary matching
            # \b matches word boundaries (start/end of word)
            pattern = r'\b' + re.escape(keyword) + r'\b'
            if re.search(pattern, lowered):
                return True
    return False


def get_default_config(tier: str) -> RouteConfig:
    """Default routing configuration per tier."""

    tier_upper = tier.upper()
    if tier_upper == "FREE":
        return RouteConfig(
            service="openrouter",
            model=settings.OPENROUTER_MODEL_LLAMA,
            reasoning=False,
            think_mode=False,
            no_think=False,
        )
    if tier_upper == "JIVE":
        return RouteConfig(
            service="cerebras",
            model=settings.MODEL_JIVE,
            reasoning=False,
            think_mode=True,  # JIVE uses Qwen thinking mode
            no_think=False,
        )
    if tier_upper == "JIGGA":
        return RouteConfig(
            service="cerebras",
            model=settings.MODEL_JIGGA,
            reasoning=False,
            think_mode=True,  # JIGGA defaults to thinking mode
            no_think=False,
        )

    raise ValueError(f"Unknown tier: {tier}")


def route_request(request: ChatRequest, user_tier: str) -> RouteConfig:
    """Structural pattern matching router for tier-based model selection.
    
    SIMPLIFIED (2025-01):
    - FREE: OpenRouter Llama 3.3 70B
    - JIVE: Cerebras Qwen 32B (thinking mode)
    - JIGGA: Cerebras Qwen 32B (default) or 235B (complex/legal keywords)
    """

    normalized_tier = user_tier.upper()

    # JIGGA tier with complex/legal keywords -> 235B model
    if normalized_tier == "JIGGA" and _matches_complex_keywords(request.message):
        return RouteConfig(
            service="cerebras",
            model=settings.MODEL_JIGGA_235B,
            reasoning=False,
            think_mode=True,  # 235B uses thinking for deep analysis
            no_think=False,
        )

    # Default routing by tier (FREE/JIVE/JIGGA default)
    return get_default_config(normalized_tier)



class TierRouter:
    """
    Routes requests based on user tier and intent.
    
    SIMPLIFIED ARCHITECTURE (2025-01):
    
    FREE Tier:
        Text → OpenRouter Llama 3.3 70B FREE
        Image → Pollinations.ai FREE
        
    JIVE Tier (Pro):
        Text → Cerebras Qwen 3 32B (thinking mode)
        Image → FLUX 1.1 Pro (capped at 200/month)
        
    JIGGA Tier (Advanced):
        Text (general) → Cerebras Qwen 3 32B (thinking mode)
        Text (complex/legal) → Cerebras Qwen 3 235B (deep reasoning)
        Image → FLUX 1.1 Pro (capped at 1000/month)
        
    Universal (all tiers):
        Prompt Enhancement → OpenRouter Llama 3.3 70B FREE
    """
    
    @staticmethod
    def classify_intent(
        message: str,
        user_tier: UserTier = UserTier.FREE,
        context_tokens: int = 0
    ) -> CognitiveLayer:
        """
        Route request to appropriate layer based on tier and intent.
        
        SIMPLIFIED (2025-01):
        - FREE: OpenRouter Llama 3.3 70B
        - JIVE: Cerebras Qwen 32B (unified - no speed/reasoning split)
        - JIGGA: Cerebras Qwen 32B (default) or 235B (complex/legal/multilingual)
        
        Args:
            message: User's input message
            user_tier: User's subscription tier
            context_tokens: Number of tokens in context (unused, kept for API compatibility)
            
        Returns:
            CognitiveLayer indicating which layer to use
        """
        _ = context_tokens  # Unused but kept for API compatibility
        message_lower = message.lower()
        
        # Check for image generation intent - only route to image layer for FREE tier
        # JIVE/JIGGA tiers use tool calling for image generation
        if is_image_prompt(message) and user_tier == UserTier.FREE:
            return CognitiveLayer.FREE_IMAGE
        
        # Text routing based on tier
        if user_tier == UserTier.FREE:
            return CognitiveLayer.FREE_TEXT
        
        elif user_tier == UserTier.JIVE:
            # JIVE tier: All text goes to Qwen 32B with thinking mode
            return CognitiveLayer.JIVE_TEXT
        
        else:  # JIGGA
            # Check for complex/legal keywords OR African language → 235B model
            if _matches_complex_keywords(message):
                return CognitiveLayer.JIGGA_COMPLEX
            if contains_african_language(message):
                return CognitiveLayer.JIGGA_COMPLEX  # 235B for multilingual
            
            # Default: 32B with thinking mode for general chat
            return CognitiveLayer.JIGGA_THINK
    
    @staticmethod
    def get_model_config(layer: CognitiveLayer) -> dict:
        """
        Get model configuration for the specified layer.
        
        Returns dict with:
        - provider: "openrouter" | "cerebras" | "deepinfra"
        - model: model identifier
        - settings: temperature, top_p, etc.
        """
        configs = {
            # FREE tier
            CognitiveLayer.FREE_TEXT: {
                "provider": "openrouter",
                "model": settings.OPENROUTER_MODEL_LLAMA,
                "settings": {"temperature": 0.7, "max_tokens": 2048},
            },
            CognitiveLayer.FREE_IMAGE: {
                "provider": "openrouter",
                "model": settings.OPENROUTER_MODEL_LONGCAT,
                "settings": {},
            },
            
            # JIVE tier (Qwen 32B)
            CognitiveLayer.JIVE_TEXT: {
                "provider": "cerebras",
                "model": settings.MODEL_JIVE,  # Qwen 3 32B
                "settings": QWEN_THINKING_SETTINGS,  # temp=0.6, top_p=0.95
            },
            CognitiveLayer.JIVE_IMAGE: {
                "provider": "deepinfra",
                "model": settings.DEEPINFRA_IMAGE_MODEL,  # FLUX 1.1 Pro
                "settings": {},
            },
            
            # JIGGA tier (Qwen 32B default, 235B for complex)
            CognitiveLayer.JIGGA_THINK: {
                "provider": "cerebras",
                "model": settings.MODEL_JIGGA,  # Qwen 3 32B
                "settings": QWEN_THINKING_SETTINGS,  # temp=0.6, top_p=0.95, top_k=20, min_p=0
            },
            CognitiveLayer.JIGGA_COMPLEX: {
                "provider": "cerebras",
                "model": settings.MODEL_JIGGA_235B,  # Qwen 3 235B for complex/legal
                "settings": QWEN_THINKING_SETTINGS,  # Thinking mode for deep reasoning
                "max_tokens": JIGGA_235B_MAX_TOKENS,  # 235B supports up to 40k output tokens
            },
            CognitiveLayer.JIGGA_IMAGE: {
                "provider": "deepinfra",
                "model": settings.DEEPINFRA_IMAGE_MODEL,  # FLUX 1.1 Pro
                "settings": {},
            },
            
            # Universal
            CognitiveLayer.ENHANCE_PROMPT: {
                "provider": "openrouter",
                "model": settings.OPENROUTER_MODEL_LLAMA,  # Llama 3.3 70B FREE
                "settings": {"temperature": 0.7, "max_tokens": 500},
            },
        }
        
        return configs.get(layer, configs[CognitiveLayer.FREE_TEXT])
    
    @staticmethod
    def get_system_prompt(layer: CognitiveLayer) -> str:
        """Get the appropriate system prompt for the specified layer."""
        from app.prompts import get_prompt_for_layer
        
        # Map CognitiveLayer enum to prompt registry keys
        # SIMPLIFIED: JIVE_TEXT maps to jive_think, JIGGA_COMPLEX to jigga_think
        layer_mapping = {
            CognitiveLayer.FREE_TEXT: "free_text",
            CognitiveLayer.JIVE_TEXT: "jive_think",  # JIVE uses thinking prompts
            CognitiveLayer.JIGGA_THINK: "jigga_think",
            CognitiveLayer.JIGGA_COMPLEX: "jigga_think",  # Same prompts, different model
            CognitiveLayer.ENHANCE_PROMPT: "enhance_prompt",
        }
        
        layer_key = layer_mapping.get(layer, "free_text")
        return get_prompt_for_layer(layer_key)


# Singleton instance
tier_router = TierRouter()

# Backwards compatibility aliases
BicameralRouter = TierRouter
bicameral_router = tier_router