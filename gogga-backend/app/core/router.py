"""
GOGGA Tier-Based Cognitive Router

All tiers use Qwen models - only token limits differ:
- FREE: Qwen 3 235B via OpenRouter (free) + Pollinations.ai (images)
- JIVE: Qwen 3 32B/235B via Cerebras + Imagen 3.0 (images, capped)
- JIGGA: Qwen 3 32B/235B via Cerebras + Imagen 3.0 (images, higher cap)

Feature parity:
- All tiers get 235B for complex queries
- All tiers get math tools
- Only difference: monthly token/image limits

SIMPLIFIED ARCHITECTURE (2025-01):
- Unified Qwen model across all tiers
- JIVE and JIGGA have identical features (just different limits)
- FREE tier uses OpenRouter only

PERFORMANCE NOTE (Dec 2025):
- Uses Aho-Corasick automaton for O(n) pattern matching across all keyword sets
- ~10x faster than previous O(n*m) approach with multiple frozenset iterations
"""
from enum import Enum
from functools import lru_cache
from typing import Final, TypedDict
import sys
import logging

from app.models.domain import ChatRequest

from app.config import settings

logger = logging.getLogger(__name__)

# Python 3.14: Enable JIT compiler for hot path optimization (20-40% faster)
if sys.version_info >= (3, 14) and hasattr(sys, '_experimental_jit'):
    sys._experimental_jit = 1  # Enable tier 1 JIT for routing hot paths

# Try to import Aho-Corasick for O(n) pattern matching
# Falls back to standard O(n*m) iteration if not available
try:
    import ahocorasick
    AHOCORASICK_AVAILABLE = True
except ImportError:
    AHOCORASICK_AVAILABLE = False
    logger.warning("pyahocorasick not installed - using slower O(n*m) pattern matching")


# -----------------------------------------------------------------------------
# OPENROUTER FALLBACK TOGGLE (Admin controlled)
# When enabled, JIVE/JIGGA tiers route to OpenRouter instead of Cerebras
# Useful for testing or when Cerebras is rate-limited
# -----------------------------------------------------------------------------
_use_openrouter_fallback: bool = False

def set_openrouter_fallback(enabled: bool) -> None:
    """Toggle OpenRouter fallback for JIVE/JIGGA tiers."""
    global _use_openrouter_fallback
    _use_openrouter_fallback = enabled

def get_openrouter_fallback() -> bool:
    """Check if OpenRouter fallback is enabled."""
    return _use_openrouter_fallback


class UserTier(str, Enum):
    """User subscription tiers."""
    FREE = "free"      # OpenRouter FREE models only
    JIVE = "jive"      # Cerebras Qwen 32B, FLUX capped
    JIGGA = "jigga"    # Cerebras Qwen 32B/235B, FLUX higher cap


class CognitiveLayer(str, Enum):
    """Enumeration of available cognitive layers."""
    # FREE tier layers (OpenRouter)
    FREE_TEXT = "free_text"              # Qwen 3 235B FREE (OpenRouter)
    FREE_IMAGE = "free_image"            # Pollinations.ai (FREE)
    
    # JIVE tier layers (Cerebras Qwen 32B/235B) - IDENTICAL to JIGGA
    JIVE_TEXT = "jive_text"              # Qwen 3 32B (general chat, thinking mode)
    JIVE_COMPLEX = "jive_complex"        # Qwen 3 235B for complex/legal/extended (thinking mode)
    JIVE_IMAGE = "jive_image"            # Imagen 3.0 (capped)
    
    # JIGGA tier layers (Cerebras Qwen 32B/235B) - IDENTICAL to JIVE
    JIGGA_THINK = "jigga_think"          # Qwen 3 32B with thinking (temp=0.6, top_p=0.95)
    JIGGA_COMPLEX = "jigga_complex"      # Qwen 3 235B for complex/legal/extended (thinking mode)
    JIGGA_IMAGE = "jigga_image"          # Imagen 3.0 (higher cap)
    
    # Universal layers
    ENHANCE_PROMPT = "enhance_prompt"    # Qwen 3 235B FREE (all tiers)
    MULTIMODAL = "multimodal"            # Google Live API (TODO)


# Image generation limits per tier (per month)
IMAGE_LIMITS: Final[dict[UserTier, int]] = {
    UserTier.FREE: 50,      # 50 Pollinations images/month
    UserTier.JIVE: 200,     # 200 FLUX images/month
    UserTier.JIGGA: 1000,   # 1000 FLUX images/month
}


# =============================================================================
# TOKEN LIMITS (Unified for JIVE and JIGGA - they are mirrors for chat)
# =============================================================================
# Qwen 32B: max 8,000 output tokens
# Qwen 235B: max 40,000 output tokens (we use 32k conservatively)

# Qwen 32B limits (used by JIVE_TEXT and JIGGA_THINK layers)
QWEN_32B_MAX_TOKENS: Final[int] = 8000     # Extended output (reports, analysis)
QWEN_32B_DEFAULT_TOKENS: Final[int] = 4096  # Normal chat responses

# Qwen 235B limits (used by JIVE_COMPLEX and JIGGA_COMPLEX layers)
QWEN_235B_MAX_TOKENS: Final[int] = 32000   # Extended output (max: 40,000)
QWEN_235B_DEFAULT_TOKENS: Final[int] = 8000  # Normal complex queries

# Legacy aliases for backwards compatibility (TODO: remove after migration)
QWEN_MAX_TOKENS = QWEN_32B_MAX_TOKENS
QWEN_DEFAULT_TOKENS = QWEN_32B_DEFAULT_TOKENS
JIGGA_235B_MAX_TOKENS = QWEN_235B_MAX_TOKENS
JIGGA_MAX_TOKENS = QWEN_32B_MAX_TOKENS
JIGGA_DEFAULT_TOKENS = QWEN_32B_DEFAULT_TOKENS

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


# Keywords that trigger extended output (8000 tokens) - uses 32B with max output
# These explicitly request long-form output but don't require 235B's complex reasoning
# NOTE: This does NOT route to 235B - it just sets max_tokens to 8000 on 32B
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
    
    # Simple report/document requests - use 32B with 8000 tokens (not 235B)
    "write a report", "write an report", "write me a report",
    "create a report", "create an report", "give me a report",
    "generate a report", "provide a report", "draft a report",
    "report on", "report for", "report about",
    "motivation report", "financial report", "savings report",
])

# Keywords that trigger 235B model for complex outputs (32k tokens max)
# These require 235B's advanced reasoning - comprehensive/detailed analysis with research
COMPLEX_OUTPUT_KEYWORDS: Final[frozenset[str]] = frozenset([
    # Professional output that requires deep analysis (routes to 235B)
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
    
    # Financial calculations that benefit from chart generation (235B follows tool instructions better)
    "savings growth", "investment growth", "compound interest",
    "loan repayment", "amortization", "mortgage calculation",
    "retirement planning", "budget breakdown", "future value",
    "chart", "graph", "visualize", "visualization",
    
    # Long/extended/expanded reports should use 235B for maximum output quality
    "long report", "extended report", "expanded report",
    "long analysis", "extended analysis", "expanded analysis",
    "maximum detail", "full detail", "complete detail",
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


# =============================================================================
# HIGH-PERFORMANCE PATTERN MATCHER (Dec 2025 Optimization)
# Uses Aho-Corasick automaton for O(n) matching across all keyword sets
# =============================================================================

class PatternCategory(str, Enum):
    """Categories of patterns for routing decisions."""
    EXTENDED_OUTPUT = "extended_output"
    COMPLEX_OUTPUT = "complex_output"
    DOCUMENT_ANALYSIS = "document_analysis"
    COMPLEX_235B = "complex_235b"
    THINKING = "thinking"
    IMAGE = "image"
    SA_BANTU = "sa_bantu"


class PatternMatcher:
    """
    High-performance pattern matcher using Aho-Corasick automaton.
    
    Processes all keyword categories in a single O(n) pass through the text,
    instead of O(n*m) where m is the number of keywords per category.
    
    Performance improvement: ~10x faster for typical messages.
    """
    
    def __init__(self):
        self._automaton = None
        self._pattern_to_categories: dict[str, set[PatternCategory]] = {}
        self._initialized = False
        
    def _build_automaton(self) -> None:
        """Build the Aho-Corasick automaton from all keyword sets."""
        # Map patterns to categories (needed for both AC and fallback)
        category_patterns = {
            PatternCategory.EXTENDED_OUTPUT: EXTENDED_OUTPUT_KEYWORDS,
            PatternCategory.COMPLEX_OUTPUT: COMPLEX_OUTPUT_KEYWORDS,
            PatternCategory.DOCUMENT_ANALYSIS: DOCUMENT_ANALYSIS_KEYWORDS,
            PatternCategory.COMPLEX_235B: COMPLEX_235B_KEYWORDS,
            PatternCategory.THINKING: THINKING_KEYWORDS,
            PatternCategory.IMAGE: IMAGE_KEYWORDS,
            PatternCategory.SA_BANTU: SA_BANTU_LANGUAGE_PATTERNS,
        }
        
        # Build mapping for all patterns
        for category, patterns in category_patterns.items():
            for pattern in patterns:
                pattern_lower = pattern.lower()
                if pattern_lower not in self._pattern_to_categories:
                    self._pattern_to_categories[pattern_lower] = set()
                self._pattern_to_categories[pattern_lower].add(category)
        
        # Build Aho-Corasick automaton if available
        if AHOCORASICK_AVAILABLE:
            self._automaton = ahocorasick.Automaton()
            for pattern in self._pattern_to_categories.keys():
                self._automaton.add_word(pattern, pattern)
            self._automaton.make_automaton()
            logger.info(f"PatternMatcher initialized with Aho-Corasick ({len(self._pattern_to_categories)} patterns)")
        else:
            logger.info(f"PatternMatcher initialized with fallback ({len(self._pattern_to_categories)} patterns)")
        
        self._initialized = True
    
    def find_categories(self, message: str) -> set[PatternCategory]:
        """
        Find all pattern categories that match in the message.
        
        Returns:
            Set of PatternCategory enums that matched
        """
        if not self._initialized:
            self._build_automaton()
        
        message_lower = message.lower()
        matched_categories: set[PatternCategory] = set()
        
        if AHOCORASICK_AVAILABLE and self._automaton:
            # O(n) Aho-Corasick matching
            for _, pattern in self._automaton.iter(message_lower):
                matched_categories.update(self._pattern_to_categories[pattern])
        else:
            # Fallback: O(n*m) substring matching
            for pattern, categories in self._pattern_to_categories.items():
                if pattern in message_lower:
                    matched_categories.update(categories)
        
        return matched_categories
    
    def matches_category(self, message: str, category: PatternCategory) -> bool:
        """Check if message matches a specific category."""
        return category in self.find_categories(message)


# Global pattern matcher instance (lazy initialization)
_pattern_matcher: PatternMatcher | None = None


def get_pattern_matcher() -> PatternMatcher:
    """Get or create the global pattern matcher instance."""
    global _pattern_matcher
    if _pattern_matcher is None:
        _pattern_matcher = PatternMatcher()
    return _pattern_matcher


def contains_african_language(message: str) -> bool:
    """
    Detect if message contains South African Bantu language content.
    This triggers the 235B model for better multilingual handling.
    
    The Qwen 3 235B Instruct model has "powerful multilingual capabilities"
    and is better suited for African language content than the 32B model.
    
    Uses optimized Aho-Corasick matching when available.
    """
    return get_pattern_matcher().matches_category(message, PatternCategory.SA_BANTU)


def is_image_prompt(prompt: str) -> bool:
    """
    Detect if a prompt is requesting image generation.
    
    Only checks the first 200 characters of the message to avoid false positives
    when RAG context or document content contains image-related words.
    
    Uses optimized Aho-Corasick matching when available.
    """
    # Only check the beginning of the message, not full RAG context
    prompt_start = prompt[:200]
    return get_pattern_matcher().matches_category(prompt_start, PatternCategory.IMAGE)


def is_extended_output_request(message: str) -> bool:
    """
    Detect if user is requesting extended/long-form output.
    
    NOTE: This does NOT route to 235B! It only sets max_tokens to 8000 on 32B.
    Simple reports like "write a report for motivation" use 32B with extended output.
    Truly complex reports ("comprehensive analysis") route to 235B via is_complex_output_request.
    
    Uses optimized Aho-Corasick matching when available.
    """
    return get_pattern_matcher().matches_category(message, PatternCategory.EXTENDED_OUTPUT)


def is_complex_output_request(message: str) -> bool:
    """
    Detect if user is requesting complex/comprehensive output that benefits from 235B.
    
    These requests require 235B's advanced reasoning capabilities:
    - Comprehensive analysis
    - Detailed reviews
    - Extended reports with research
    
    Routes to 235B (JIGGA_COMPLEX/JIVE_COMPLEX layer).
    Uses optimized Aho-Corasick matching when available.
    """
    return get_pattern_matcher().matches_category(message, PatternCategory.COMPLEX_OUTPUT)


def is_document_analysis_request(message: str) -> bool:
    """
    Detect if user is requesting a document, analysis, report, or professional output.
    These requests should trigger comprehensive, structured, verbose output.
    
    Uses optimized Aho-Corasick matching when available.
    """
    return get_pattern_matcher().matches_category(message, PatternCategory.DOCUMENT_ANALYSIS)


# Comprehensive output format instruction for document/analysis requests
# This is appended to the user's message when document analysis is detected
# IMPORTANT: Preserve GOGGA personality - formal structure but SA voice
COMPREHENSIVE_OUTPUT_INSTRUCTION: Final[str] = """

---
[SYSTEM: Formal Document/Report Requested]

The user has explicitly requested a formal document, report, or analysis.
Provide well-structured, comprehensive output BUT maintain your GOGGA personality:
- Keep your SA voice and context (Rands, local references, etc.)
- You can still be warm and helpful, just more structured
- Use clear headings and sections (Executive Summary, Analysis, Recommendations)
- Be thorough and use the FULL token limit available
- User's explicit format requests ALWAYS override these defaults

📊 MANDATORY: If your report contains ANY numbers or financial data:
- You MUST include a chart using the create_chart tool
- Financial/savings reports → line chart showing growth
- Comparisons → bar chart
- Distributions → pie chart
- Do NOT skip the chart - it is required for numerical reports

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
    """Check if message matches any COMPLEX_235B_KEYWORDS.
    
    Uses optimized Aho-Corasick matching when available.
    Falls back to word boundary regex matching for single-word keywords
    to avoid false positives like 'rica' matching 'Africa'.
    """
    # Use optimized pattern matcher
    return get_pattern_matcher().matches_category(message, PatternCategory.COMPLEX_235B)


class TierRouter:
    """
    Routes requests based on user tier and intent.
    
    SIMPLIFIED ARCHITECTURE (2025-01):
    
    FREE Tier:
        Text → OpenRouter Qwen 3 235B FREE
        Image → Pollinations.ai FREE
        
    JIVE & JIGGA Tiers (IDENTICAL features, different limits):
        Text (general/chat/math) → Cerebras Qwen 3 32B (thinking mode)
        Text (complex/legal/extended) → Cerebras Qwen 3 235B (deep reasoning)
        Image → FLUX 1.1 Pro (JIVE: 200/month, JIGGA: 1000/month)
        
    Only difference between JIVE and JIGGA: monthly token/image limits.
        
    Universal (all tiers):
        Prompt Enhancement → OpenRouter Qwen 3 235B FREE
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
        - FREE: OpenRouter Qwen 3 235B
        - JIVE/JIGGA: IDENTICAL features, different limits
          - General/chat/math → Cerebras Qwen 32B (thinking mode)
          - Complex/legal/extended → Cerebras Qwen 235B (deep reasoning)
        
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
            # JIVE tier: 32B for most queries, 235B for truly complex/legal/multilingual
            if _matches_complex_keywords(message):
                return CognitiveLayer.JIVE_COMPLEX
            if contains_african_language(message):
                return CognitiveLayer.JIVE_COMPLEX  # 235B for multilingual
            if is_complex_output_request(message):
                return CognitiveLayer.JIVE_COMPLEX  # 235B for comprehensive analysis
            
            # Simple reports and extended output use 32B with 8000 tokens
            # is_extended_output_request is checked in AI service for max_tokens
            return CognitiveLayer.JIVE_TEXT
        
        else:  # JIGGA
            # JIGGA tier: 32B for most queries, 235B for truly complex/legal/multilingual
            if _matches_complex_keywords(message):
                return CognitiveLayer.JIGGA_COMPLEX
            if contains_african_language(message):
                return CognitiveLayer.JIGGA_COMPLEX  # 235B for multilingual
            if is_complex_output_request(message):
                return CognitiveLayer.JIGGA_COMPLEX  # 235B for comprehensive analysis
            
            # Simple reports and extended output use 32B with 8000 tokens
            # is_extended_output_request is checked in AI service for max_tokens
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
                "model": settings.OPENROUTER_MODEL_QWEN,
                "settings": {"temperature": 0.7, "max_tokens": 2048},
            },
            CognitiveLayer.FREE_IMAGE: {
                "provider": "openrouter",
                "model": settings.OPENROUTER_MODEL_LONGCAT,
                "settings": {},
            },
            
            # JIVE tier (Qwen 32B default, 235B for complex) - IDENTICAL to JIGGA
            CognitiveLayer.JIVE_TEXT: {
                "provider": "cerebras",
                "model": settings.MODEL_JIVE,  # Qwen 3 32B
                "settings": QWEN_THINKING_SETTINGS,  # temp=0.6, top_p=0.95
            },
            CognitiveLayer.JIVE_COMPLEX: {
                "provider": "cerebras",
                "model": settings.MODEL_JIGGA_235B,  # Qwen 3 235B for complex/legal/extended
                "settings": QWEN_THINKING_SETTINGS,  # Thinking mode for deep reasoning
                "max_tokens": JIGGA_235B_MAX_TOKENS,  # 235B supports up to 40k output tokens
            },
            CognitiveLayer.JIVE_IMAGE: {
                "provider": "deepinfra",
                "model": settings.DEEPINFRA_IMAGE_MODEL,  # FLUX 1.1 Pro
                "settings": {},
            },
            
            # JIGGA tier (Qwen 32B default, 235B for complex) - IDENTICAL to JIVE
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
                "model": settings.OPENROUTER_MODEL_QWEN,  # Qwen 3 235B FREE
                "settings": {"temperature": 0.7, "max_tokens": 500},
            },
        }
        
        return configs.get(layer, configs[CognitiveLayer.FREE_TEXT])
    
    @staticmethod
    def get_system_prompt(layer: CognitiveLayer) -> str:
        """Get the appropriate system prompt for the specified layer."""
        from app.prompts import get_prompt_for_layer
        
        # Map CognitiveLayer enum to prompt registry keys
        # NOTE: JIVE and JIGGA are mirrors for chat - both use thinking prompts
        layer_mapping = {
            CognitiveLayer.FREE_TEXT: "free_text",
            CognitiveLayer.JIVE_TEXT: "jive_think",     # JIVE 32B with thinking
            CognitiveLayer.JIVE_COMPLEX: "jive_think",  # JIVE 235B - same prompt, bigger model
            CognitiveLayer.JIGGA_THINK: "jigga_think",  # JIGGA 32B with thinking  
            CognitiveLayer.JIGGA_COMPLEX: "jigga_think", # JIGGA 235B - same prompt, bigger model
            CognitiveLayer.ENHANCE_PROMPT: "enhance_prompt",
        }
        
        layer_key = layer_mapping.get(layer, "free_text")
        return get_prompt_for_layer(layer_key)


# Singleton instance
tier_router = TierRouter()

# Backwards compatibility aliases
BicameralRouter = TierRouter
bicameral_router = tier_router