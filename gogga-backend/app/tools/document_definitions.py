"""
Gogga Document Tool - Type Definitions and Core Data Structures

This module contains all type definitions, enums, and data structures
for the document generation tool. Uses immutable dataclasses and
strict Pydantic models for type safety.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, ClassVar

from pydantic import BaseModel, Field


# =============================================================================
# ENUMS - Document Classification
# =============================================================================

class DocumentDomain(str, Enum):
    """Top-level document domains for classification"""
    LEGAL = "legal"
    BUSINESS = "business"
    TECHNICAL = "technical"
    ACADEMIC = "academic"
    CREATIVE = "creative"
    PERSONAL = "personal"
    GOVERNMENT = "government"
    HEALTHCARE = "healthcare"
    FINANCIAL = "financial"
    GENERAL = "general"


class DocumentIntent(str, Enum):
    """User intent classification for document requests"""
    CREATE = "create"           # New document from scratch
    TRANSFORM = "transform"     # Convert/reformat existing content
    ANALYZE = "analyze"         # Analyze and report on content
    TEMPLATE = "template"       # Create reusable template
    SUMMARIZE = "summarize"     # Condense content
    EXPAND = "expand"           # Elaborate on content
    TRANSLATE = "translate"     # Language translation
    FORMALIZE = "formalize"     # Make more formal
    SIMPLIFY = "simplify"       # Make more accessible


class DocumentComplexity(str, Enum):
    """Complexity levels for model routing decisions"""
    TRIVIAL = "trivial"         # 1500 tokens max
    SIMPLE = "simple"           # 4000 tokens max
    MODERATE = "moderate"       # 6000 tokens max
    COMPLEX = "complex"         # 15000 tokens max
    EXPERT = "expert"           # 30000 tokens max


# =============================================================================
# DOCUMENT PROFILE - Immutable Classification Result
# =============================================================================

@dataclass(frozen=True, slots=True)
class DocumentProfile:
    """
    Immutable document classification profile.
    
    Uses frozen dataclass for hashability and thread safety.
    Created by DocumentClassifier.classify() method.
    """
    domain: DocumentDomain
    intent: DocumentIntent
    complexity: DocumentComplexity
    document_type: str
    confidence: float
    triggers_matched: tuple[str, ...]  # Immutable tuple
    requires_235b: bool
    reasoning_required: bool
    estimated_tokens: int

    @property
    def is_high_stakes(self) -> bool:
        """Check if document requires extra care (legal, medical, financial)"""
        return self.domain in {
            DocumentDomain.LEGAL,
            DocumentDomain.HEALTHCARE,
            DocumentDomain.FINANCIAL,
            DocumentDomain.GOVERNMENT,
        }
    
    @property
    def model_recommendation(self) -> str:
        """Get recommended model based on profile"""
        if self.requires_235b:
            return "qwen-235b"
        return "qwen-32b"


# =============================================================================
# PYDANTIC MODELS - Tool Input/Output Schemas
# =============================================================================

class DocumentToolInput(BaseModel):
    """
    Input schema for document tool - used in AI function calling.
    
    The AI invokes this tool when it determines a structured document
    is more appropriate than a conversational response.
    """
    content: str = Field(
        ...,
        min_length=10,
        max_length=15000,
        description="The document content or detailed request"
    )
    document_type: str | None = Field(
        None,
        description="Specific document type (contract, proposal, cv, letter, etc.)"
    )
    language: str | None = Field(
        None,
        description="Target language code (en, af, zu, xh, st, tn, ve, ts, nr, ss, nso)"
    )
    formality: str = Field(
        "formal",
        pattern="^(formal|semi-formal|casual)$",
        description="Document formality level"
    )
    include_sa_context: bool = Field(
        True,
        description="Include South African legal/business context"
    )
    additional_requirements: str | None = Field(
        None,
        max_length=2000,
        description="Extra instructions from user"
    )

    model_config = {"extra": "forbid"}


class DocumentToolOutput(BaseModel):
    """Output schema for document tool results"""
    title: str = Field(..., description="Extracted document title")
    content: str = Field(..., description="Generated document content")
    domain: str = Field(..., description="Detected document domain")
    document_type: str = Field(..., description="Specific document type")
    language: str = Field(..., description="Output language name")
    word_count: int = Field(..., description="Word count of generated document")
    model_used: str = Field(..., description="AI model used for generation")
    thinking_mode: bool = Field(..., description="Whether thinking mode was used")
    
    # Token tracking for accurate billing (populated from API response)
    input_tokens: int = Field(0, description="Actual input tokens from API")
    output_tokens: int = Field(0, description="Actual output tokens from API")
    reasoning_tokens: int = Field(0, description="Reasoning tokens (thinking mode)")
    cost_usd: float = Field(0.0, description="Actual cost in USD")
    cost_zar: float = Field(0.0, description="Actual cost in ZAR")

    model_config = {"extra": "forbid"}


# =============================================================================
# LANGUAGE CONFIGURATION
# =============================================================================

@dataclass(frozen=True)
class SALanguage:
    """South African language configuration"""
    code: str
    name: str
    name_english: str
    requires_235b: bool = False  # Complex morphology needs better model
    
    # Common greetings for detection
    greetings: tuple[str, ...] = field(default_factory=tuple)


# All 11 SA official languages
SA_LANGUAGES: dict[str, SALanguage] = {
    "en": SALanguage("en", "English", "English", False, ("hello", "hi", "good morning")),
    "af": SALanguage("af", "Afrikaans", "Afrikaans", False, ("hallo", "goeie môre", "goeie dag")),
    "zu": SALanguage("zu", "isiZulu", "Zulu", True, ("sawubona", "sanibonani", "yebo")),
    "xh": SALanguage("xh", "isiXhosa", "Xhosa", True, ("molo", "molweni", "enkosi")),
    "st": SALanguage("st", "Sesotho", "Sotho", True, ("dumela", "dumelang", "kea leboha")),
    "tn": SALanguage("tn", "Setswana", "Tswana", True, ("dumela", "dumelang", "ke a leboga")),
    "ve": SALanguage("ve", "Tshivenḓa", "Venda", True, ("ndi matshelo", "aa", "ndo livhuwa")),
    "ts": SALanguage("ts", "Xitsonga", "Tsonga", True, ("avuxeni", "xewani", "ndza khensa")),
    "nr": SALanguage("nr", "isiNdebele", "Ndebele", True, ("lotjhani", "salibonani", "ngiyathokoza")),
    "ss": SALanguage("ss", "siSwati", "Swati", True, ("sawubona", "sanibonani", "ngiyabonga")),
    "nso": SALanguage("nso", "Sepedi", "Northern Sotho", True, ("thobela", "dumelang", "ke a leboga")),
}


# =============================================================================
# TOOL DEFINITION - For AI Function Calling
# =============================================================================

# OpenAI-compatible tool definition for registration
DOCUMENT_TOOL_DEFINITION: dict[str, Any] = {
    "type": "function",
    "function": {
        "name": "generate_document",
        "strict": True,
        "description": (
            "Generate a professional, structured document. Use this tool when:\n"
            "- User explicitly asks for a document, contract, letter, CV, proposal, report, etc.\n"
            "- A formal/structured output is more appropriate than conversational response\n"
            "- User needs something they can directly use or submit\n"
            "- Request involves legal, business, academic, or official documents\n\n"
            "Do NOT use for:\n"
            "- General questions or explanations\n"
            "- Casual conversation\n"
            "- Quick answers that don't need formal structure"
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "content": {
                    "type": "string",
                    "description": (
                        "The document content or detailed request. "
                        "Include all necessary details like parties, dates, amounts, requirements."
                    )
                },
                "document_type": {
                    "type": "string",
                    "description": (
                        "Specific document type: contract, proposal, cv, cover_letter, "
                        "letter, report, policy, affidavit, nda, invoice, quotation, etc."
                    )
                },
                "language": {
                    "type": "string",
                    "description": (
                        "Target language code. Supports all 11 SA languages: "
                        "en (English), af (Afrikaans), zu (isiZulu), xh (isiXhosa), "
                        "st (Sesotho), tn (Setswana), ve (Tshivenḓa), ts (Xitsonga), "
                        "nr (isiNdebele), ss (siSwati), nso (Sepedi)"
                    )
                },
                "formality": {
                    "type": "string",
                    "description": "Document formality level",
                    "enum": ["formal", "semi-formal", "casual"]
                },
                "include_sa_context": {
                    "type": "boolean",
                    "description": (
                        "Include South African legal/business context (POPIA, CPA, LRA, etc.). "
                        "Default: true. Set false for international documents."
                    )
                },
                "additional_requirements": {
                    "type": "string",
                    "description": "Extra instructions or specific requirements from user"
                }
            },
            "required": ["content"],
            "additionalProperties": False
        }
    }
}


# Token estimates by complexity level
TOKEN_ESTIMATES: dict[DocumentComplexity, int] = {
    DocumentComplexity.TRIVIAL: 1500,
    DocumentComplexity.SIMPLE: 4000,
    DocumentComplexity.MODERATE: 6000,
    DocumentComplexity.COMPLEX: 15000,
    DocumentComplexity.EXPERT: 30000,
}


def get_token_estimate(complexity: DocumentComplexity) -> int:
    """Get token estimate for a complexity level"""
    return TOKEN_ESTIMATES.get(complexity, 4000)
