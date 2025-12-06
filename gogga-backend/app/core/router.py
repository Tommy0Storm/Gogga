"""
GOGGA Tier-Based Cognitive Router

Routes requests based on user subscription tier:
- FREE: OpenRouter Llama 3.3 70B (text) + Pollinations.ai (images)
- JIVE: Cerebras Llama 3.1 8B + CePO (text) + FLUX 1.1 Pro (images, capped)
- JIGGA: Cerebras Qwen 3 235B think/no_think (text) + FLUX 1.1 Pro (images, higher cap)

Universal across all tiers:
- Prompt Enhancement: OpenRouter Llama 3.3 70B FREE
"""
from enum import Enum
from functools import lru_cache
from typing import Final

from app.config import settings


class UserTier(str, Enum):
    """User subscription tiers."""
    FREE = "free"      # OpenRouter FREE models only
    JIVE = "jive"      # Cerebras Llama + CePO, FLUX capped
    JIGGA = "jigga"    # Cerebras Qwen think/no_think, FLUX higher cap


class CognitiveLayer(str, Enum):
    """Enumeration of available cognitive layers."""
    # FREE tier layers (OpenRouter)
    FREE_TEXT = "free_text"              # Llama 3.3 70B FREE (OpenRouter)
    FREE_IMAGE = "free_image"            # Pollinations.ai (FREE)
    
    # JIVE tier layers (Cerebras + CePO)
    JIVE_SPEED = "jive_speed"            # Llama 3.1 8B direct (fast queries)
    JIVE_REASONING = "jive_reasoning"    # Llama 3.1 8B + CePO (complex queries)
    JIVE_IMAGE = "jive_image"            # FLUX 1.1 Pro (capped)
    
    # JIGGA tier layers (Cerebras Qwen)
    JIGGA_THINK = "jigga_think"          # Qwen 3 235B with thinking (temp=0.6, top_p=0.95)
    JIGGA_FAST = "jigga_fast"            # Qwen 3 235B + /no_think (fast response)
    JIGGA_IMAGE = "jigga_image"          # FLUX 1.1 Pro (higher cap)
    
    # Universal layers
    ENHANCE_PROMPT = "enhance_prompt"    # Llama 3.3 70B FREE (all tiers)
    MULTIMODAL = "multimodal"            # Google Live API (TODO)


# Image generation limits per tier (per month)
IMAGE_LIMITS: Final[dict[UserTier, int]] = {
    UserTier.FREE: 50,      # 50 Pollinations images/month
    UserTier.JIVE: 200,     # 200 FLUX images/month
    UserTier.JIGGA: 1000,   # 1000 FLUX images/month
}


# Qwen thinking mode settings (JIGGA tier)
# Token limits
# NOTE: Llama 3.3 70B supports up to 40,000 output tokens on Cerebras
# Currently limited to 8,000 for cost control - increase to 40,000 when ready
JIVE_MAX_TOKENS: Final[int] = 8000  # Llama 3.3 70B extended output (max: 40,000)
JIVE_DEFAULT_TOKENS: Final[int] = 4096  # Default for normal requests

# JIGGA Token limits (Qwen 3 32B)
# Context: 131k tokens | Max Output: 8k tokens
# For long contexts (>100k), consider using /no_think to save context budget
JIGGA_MAX_TOKENS: Final[int] = 8000  # Qwen 3 32B max output
JIGGA_DEFAULT_TOKENS: Final[int] = 4096  # Default for casual chat

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


# Keywords that trigger CePO Reasoning (JIVE tier)
REASONING_KEYWORDS: Final[frozenset[str]] = frozenset([
    "think step by step", "reason through", "plan out", "break down",
    "walk me through", "explain your reasoning", "show your work",
    "let's think", "consider all", "weigh the options",
    "optimize", "design a solution", "architect", "strategy",
    "implementation plan", "roadmap", "approach this",
])

# Keywords that trigger thinking mode (JIGGA tier)
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

# Keywords that trigger fast mode /no_think (JIGGA tier)
# Also auto-triggered for long contexts (131k+ tokens)
FAST_MODE_KEYWORDS: Final[frozenset[str]] = frozenset([
    "quick answer", "briefly", "short answer", "tldr", "summary",
    "just tell me", "simple answer", "fast", "quickly",
])

# Complex keywords (for JIVE tier routing to CePO)
COMPLEX_KEYWORDS: Final[frozenset[str]] = frozenset([
    # Legal terms
    "popia", "gdpr", "constitution", "act", "regulation", "compliance",
    "contract", "clause", "liability", "indemnity", "lawsuit", "court",
    "tribunal", "advocate", "attorney", "litigation", "damages", "rights",
    "consumer protection", "rental housing", "labour", "employment",
    "bbbee", "b-bbee", "fica", "rica", "sars",
    
    # Coding and technical
    "code", "function", "class", "algorithm", "debug", "api", "database",
    "python", "javascript", "typescript", "react", "fastapi", "django",
    "sql", "query", "optimization", "architecture", "deploy", "docker",
    
    # Translation
    "translate", "isizulu", "isixhosa", "afrikaans", "sesotho", "setswana",
    "tshivenda", "xitsonga", "siswati", "isindebele", "sepedi",
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
    
    Returns False (use /no_think) if:
    - Message contains fast mode keywords
    - Context is very long (131k+ tokens)
    
    Returns True (use thinking) if:
    - Message contains thinking keywords
    - Default for complex queries
    """
    message_lower = message.lower()
    
    # Fast mode keywords → disable thinking
    if any(keyword in message_lower for keyword in FAST_MODE_KEYWORDS):
        return False
    
    # Long context → disable thinking for accuracy
    if context_tokens > 100000:  # ~100k tokens
        return False
    
    # Thinking keywords → enable thinking
    if any(keyword in message_lower for keyword in THINKING_KEYWORDS):
        return True
    
    # Default: use thinking for JIGGA tier
    return True


class TierRouter:
    """
    Routes requests based on user tier and intent.
    
    FREE Tier:
        Text → OpenRouter Llama 3.3 70B FREE
        Image → Pollinations.ai FREE
        
    JIVE Tier (Pro):
        Simple text → Cerebras Llama 3.1 8B direct
        Complex text → Cerebras Llama 3.1 8B + CePO
        Image → FLUX 1.1 Pro (capped at 200/month)
        
    JIGGA Tier (Advanced):
        Text (thinking) → Cerebras Qwen 3 235B (temp=0.6, top_p=0.95)
        Text (fast) → Cerebras Qwen 3 235B + /no_think
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
        
        Args:
            message: User's input message
            user_tier: User's subscription tier
            context_tokens: Number of tokens in context (for thinking mode decision)
            
        Returns:
            CognitiveLayer indicating which layer to use
        """
        message_lower = message.lower()
        
        # Check for image generation intent - only route to image layer for FREE tier
        # JIVE/JIGGA tiers use tool calling for image generation
        if is_image_prompt(message) and user_tier == UserTier.FREE:
            return CognitiveLayer.FREE_IMAGE
        
        # Text routing based on tier
        if user_tier == UserTier.FREE:
            return CognitiveLayer.FREE_TEXT
        
        elif user_tier == UserTier.JIVE:
            # Check for reasoning/complex keywords → CePO
            if any(kw in message_lower for kw in REASONING_KEYWORDS):
                return CognitiveLayer.JIVE_REASONING
            if any(kw in message_lower for kw in COMPLEX_KEYWORDS):
                return CognitiveLayer.JIVE_REASONING
            # Simple queries → direct Llama
            return CognitiveLayer.JIVE_SPEED
        
        else:  # JIGGA
            # Determine thinking vs fast mode
            if should_use_thinking(message, context_tokens):
                return CognitiveLayer.JIGGA_THINK
            else:
                return CognitiveLayer.JIGGA_FAST
    
    @staticmethod
    def get_model_config(layer: CognitiveLayer) -> dict:
        """
        Get model configuration for the specified layer.
        
        Returns dict with:
        - provider: "openrouter" | "cerebras" | "deepinfra"
        - model: model identifier
        - settings: temperature, top_p, etc.
        - use_cepo: whether to route through CePO sidecar
        - append_no_think: whether to append /no_think
        """
        configs = {
            # FREE tier
            CognitiveLayer.FREE_TEXT: {
                "provider": "openrouter",
                "model": settings.OPENROUTER_MODEL_LLAMA,
                "settings": {"temperature": 0.7, "max_tokens": 2048},
                "use_cepo": False,
                "append_no_think": False,
            },
            CognitiveLayer.FREE_IMAGE: {
                "provider": "openrouter",
                "model": settings.OPENROUTER_MODEL_LONGCAT,
                "settings": {},
                "use_cepo": False,
                "append_no_think": False,
            },
            
            # JIVE tier
            CognitiveLayer.JIVE_SPEED: {
                "provider": "cerebras",
                "model": settings.MODEL_CEPO,  # Llama 3.3 70B at 2,000 tokens/s
                "settings": {"temperature": 0.7, "max_tokens": 4096},
                "use_cepo": False,
                "append_no_think": False,
            },
            CognitiveLayer.JIVE_REASONING: {
                "provider": "cerebras",
                "model": settings.MODEL_CEPO,  # Llama 3.3 70B at 2,000 reasoning tokens/s
                "settings": {"temperature": 0.7, "max_tokens": 4096},
                "use_cepo": False,  # Direct API (OptiLLM CePO has reasoning_effort bug)
                "append_no_think": False,
            },
            CognitiveLayer.JIVE_IMAGE: {
                "provider": "deepinfra",
                "model": settings.DEEPINFRA_IMAGE_MODEL,  # FLUX 1.1 Pro
                "settings": {},
                "use_cepo": False,
                "append_no_think": False,
            },
            
            # JIGGA tier
            CognitiveLayer.JIGGA_THINK: {
                "provider": "cerebras",
                "model": settings.MODEL_COMPLEX,  # Qwen 3 32B
                "settings": QWEN_THINKING_SETTINGS,  # temp=0.6, top_p=0.95, top_k=20, min_p=0
                "use_cepo": False,
                "append_no_think": False,
            },
            CognitiveLayer.JIGGA_FAST: {
                "provider": "cerebras",
                "model": settings.MODEL_COMPLEX,  # Qwen 3 32B
                "settings": QWEN_FAST_SETTINGS,  # temp=0.7, top_p=0.8, top_k=20, min_p=0
                "use_cepo": False,
                "append_no_think": True,  # Append /no_think to prompt
            },
            CognitiveLayer.JIGGA_IMAGE: {
                "provider": "deepinfra",
                "model": settings.DEEPINFRA_IMAGE_MODEL,  # FLUX 1.1 Pro
                "settings": {},
                "use_cepo": False,
                "append_no_think": False,
            },
            
            # Universal
            CognitiveLayer.ENHANCE_PROMPT: {
                "provider": "openrouter",
                "model": settings.OPENROUTER_MODEL_LLAMA,  # Llama 3.3 70B FREE
                "settings": {"temperature": 0.7, "max_tokens": 500},
                "use_cepo": False,
                "append_no_think": False,
            },
        }
        
        return configs.get(layer, configs[CognitiveLayer.FREE_TEXT])
    
    @staticmethod
    def get_system_prompt(layer: CognitiveLayer) -> str:
        """Get the appropriate system prompt for the specified layer."""
        from app.prompts import get_prompt_for_layer
        
        # Map CognitiveLayer enum to prompt registry keys
        layer_mapping = {
            CognitiveLayer.FREE_TEXT: "free_text",
            CognitiveLayer.JIVE_SPEED: "jive_speed",
            CognitiveLayer.JIVE_REASONING: "jive_reasoning",
            CognitiveLayer.JIGGA_THINK: "jigga_think",
            CognitiveLayer.JIGGA_FAST: "jigga_fast",
            CognitiveLayer.ENHANCE_PROMPT: "enhance_prompt",
        }
        
        layer_key = layer_mapping.get(layer, "free_text")
        return get_prompt_for_layer(layer_key)


# Singleton instance
tier_router = TierRouter()

# Backwards compatibility aliases
BicameralRouter = TierRouter
bicameral_router = tier_router
