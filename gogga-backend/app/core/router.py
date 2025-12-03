"""
GOGGA Bicameral Router
The semantic traffic controller that evaluates cognitive load and routes requests
to the appropriate model tier (Speed Layer vs Complex Layer).
"""
from enum import Enum
from functools import lru_cache
from typing import Final

from app.config import settings


class CognitiveLayer(str, Enum):
    """Enumeration of available cognitive layers."""
    SPEED = "speed"              # Fast responses for simple queries (Llama 3.1 8B)
    COMPLEX = "complex"          # Advanced reasoning for legal/coding (Qwen 3 235B)
    REASONING = "reasoning"      # CePO-enhanced planning (default: Llama 3.1 8B)
    REASONING_DEEP = "reasoning_deep"  # CePO-enhanced planning (Qwen 3 235B)


# Threshold for word count that triggers Complex Layer
WORD_COUNT_THRESHOLD: Final[int] = 50

# Keywords that trigger CePO Reasoning Layer (multi-step planning)
# Default uses Llama 3.1 8B for fast CePO reasoning
REASONING_KEYWORDS: Final[frozenset[str]] = frozenset([
    # Explicit reasoning requests
    "think step by step", "reason through", "plan out", "break down",
    "walk me through", "explain your reasoning", "show your work",
    "let's think", "consider all", "weigh the options",
    
    # Complex problem solving
    "optimize", "design a solution", "architect", "strategy",
    "implementation plan", "roadmap", "approach this",
])

# Keywords that trigger DEEP CePO Reasoning (Qwen 3 235B)
# For very complex multi-step problems
REASONING_DEEP_KEYWORDS: Final[frozenset[str]] = frozenset([
    # Multi-part legal analysis
    "legal implications", "case analysis", "precedent",
    "constitutional analysis", "statutory interpretation",
    "comprehensive legal", "full legal review",
    
    # Complex coding tasks
    "refactor entire", "design pattern", "system design", "scale",
    "performance optimization", "debug this complex",
    "architect the", "full implementation",
])

# Keywords that trigger the Complex Layer (Qwen 3 235B)
# Using frozenset for O(1) lookup performance
COMPLEX_KEYWORDS: Final[frozenset[str]] = frozenset([
    # Legal terms
    "popia", "gdpr", "constitution", "act", "regulation", "compliance",
    "contract", "clause", "liability", "indemnity", "lawsuit", "court",
    "tribunal", "advocate", "attorney", "litigation", "damages", "rights",
    "consumer protection", "rental housing", "labour", "employment",
    
    # South African legal specifics
    "bbbee", "b-bbee", "fica", "rica", "irs", "sars", "commissioner",
    
    # Coding and technical
    "code", "function", "class", "algorithm", "debug", "api", "database",
    "python", "javascript", "typescript", "react", "fastapi", "django",
    "sql", "query", "optimization", "architecture", "deploy", "docker",
    
    # Translation and language
    "translate", "isizulu", "isixhosa", "afrikaans", "sesotho", "setswana",
    "tshivenda", "xitsonga", "siswati", "isindebele", "sepedi",
    
    # Complex reasoning
    "analyze", "analyse", "compare", "evaluate", "explain in detail",
    "step by step", "comprehensive", "thorough", "research", "study",
    "calculate", "derive", "prove", "hypothesis", "methodology"
])


class BicameralRouter:
    """
    The Bicameral Router determines which cognitive layer should handle a request.
    
    Speed Layer (Reflexive Mind): 
        - Llama 3.1 8B via Cerebras
        - ~2,200 tokens/second
        - $0.10 per million tokens
        - Use for: greetings, simple definitions, UI navigation help
    
    Complex Layer (Analytical Mind):
        - Qwen 3 235B via Cerebras
        - ~1,400 tokens/second
        - $0.60 input / $1.20 output per million tokens
        - Use for: legal analysis, translation, coding, complex reasoning
    """
    
    @staticmethod
    def classify_intent(message: str) -> CognitiveLayer:
        """
        Determines whether to route to Speed, Complex, or Reasoning Layer.
        
        Logic:
        1. Check for deep reasoning keywords (triggers CePO with Qwen)
        2. Check for reasoning keywords (triggers CePO with Llama)
        3. Check for 'heavy' keywords (legal, coding, translation)
        4. Check for input length (long contexts require bigger models)
        5. Default to speed
        
        Args:
            message: The user's input message
            
        Returns:
            CognitiveLayer indicating which layer to use
        """
        message_lower = message.lower()
        
        # First, check for deep reasoning keywords (CePO with Qwen 3 235B)
        if any(keyword in message_lower for keyword in REASONING_DEEP_KEYWORDS):
            return CognitiveLayer.REASONING_DEEP
        
        # Check for reasoning keywords (CePO with Llama 3.1 8B - faster)
        if any(keyword in message_lower for keyword in REASONING_KEYWORDS):
            return CognitiveLayer.REASONING
        
        # Check for complex keywords using frozenset for O(1) lookups
        if any(keyword in message_lower for keyword in COMPLEX_KEYWORDS):
            return CognitiveLayer.COMPLEX
        
        # Check for input length - long contexts need bigger models
        word_count = len(message.split())
        
        return CognitiveLayer.COMPLEX if word_count > WORD_COUNT_THRESHOLD else CognitiveLayer.SPEED
    
    @staticmethod
    def get_model_id(layer: CognitiveLayer) -> str:
        """
        Get the model identifier for the specified layer.
        
        Args:
            layer: CognitiveLayer enum value
            
        Returns:
            The model ID string for Cerebras API
        """
        if layer in (CognitiveLayer.SPEED, CognitiveLayer.REASONING):
            # Speed and fast Reasoning use Llama 3.1 8B
            return settings.MODEL_SPEED
        # COMPLEX and REASONING_DEEP use Qwen 3 235B
        return settings.MODEL_COMPLEX
    
    @staticmethod
    @lru_cache(maxsize=3)
    def get_system_prompt(layer: CognitiveLayer) -> str:
        """
        Get the appropriate system prompt for the specified layer.
        Uses lru_cache since prompts are static per layer.
        
        Args:
            layer: CognitiveLayer enum value
            
        Returns:
            The system prompt string
        """
        base_prompt = (
            "You are Gogga, a helpful, witty, and knowledgeable South African AI assistant. "
            "You speak English but understand local slang (Mzansi style). "
            "Be concise and helpful."
        )
        
        if layer == CognitiveLayer.COMPLEX:
            base_prompt += (
                " You are currently operating in 'Complex Mode'. "
                "You are an expert in South African law, advanced coding, and complex analysis. "
                "When discussing legal matters, cite relevant South African Acts "
                "(e.g., POPIA, CPA, The Constitution Chapter 2 - Bill of Rights). "
                "Be precise and authoritative."
            )
        elif layer == CognitiveLayer.REASONING:
            base_prompt += (
                " You are currently operating in 'Reasoning Mode' with CePO optimization. "
                "Think step by step. Break down complex problems into manageable parts. "
                "Consider multiple approaches before selecting the best one. "
                "Show your reasoning process clearly. "
                "For legal matters, analyze from multiple angles and cite precedents. "
                "For coding, consider edge cases and optimize for maintainability."
            )
        
        return base_prompt


# Singleton instance for the router
bicameral_router = BicameralRouter()
