"""
Gogga Document Classifier - Multi-dimensional Document Classification

Classifies document requests using:
- Weighted trigger matching for domain detection
- Pattern matching for intent detection
- Multi-factor complexity assessment
- Automatic 235B routing for African languages and complex requests
"""

from __future__ import annotations

import re
from typing import ClassVar

from app.tools.document_definitions import (
    DocumentComplexity,
    DocumentDomain,
    DocumentIntent,
    DocumentProfile,
    TOKEN_ESTIMATES,
)


class DocumentClassifier:
    """
    Multi-dimensional document classifier using weighted triggers,
    pattern matching, and contextual analysis.
    """
    
    # =========================================================================
    # DOMAIN TRIGGERS - Weighted importance (0.0-1.0)
    # =========================================================================
    
    DOMAIN_TRIGGERS: ClassVar[dict[DocumentDomain, dict[str, float]]] = {
        DocumentDomain.LEGAL: {
            # High confidence SA legal triggers
            "popia": 0.95, "ccma": 0.95, "lra": 0.95, "bcea": 0.95,
            "cpa": 0.90, "nca": 0.90, "bbbee": 0.85, "constitutional": 0.95,
            # General legal triggers
            "contract": 0.90, "agreement": 0.85, "litigation": 0.95,
            "affidavit": 0.95, "indemnity": 0.90, "liability": 0.80,
            "jurisdiction": 0.85, "arbitration": 0.90, "plaintiff": 0.95,
            "defendant": 0.95, "deponent": 0.95, "warranty": 0.70,
            "nda": 0.90, "non-disclosure": 0.90, "confidentiality agreement": 0.90,
            "terms and conditions": 0.85, "terms of service": 0.85,
            "privacy policy": 0.90, "employment contract": 0.95,
            # Medium confidence
            "legal": 0.75, "terms": 0.50, "conditions": 0.50,
            "clause": 0.60, "provision": 0.60, "compliance": 0.75,
        },
        DocumentDomain.BUSINESS: {
            "proposal": 0.85, "business plan": 0.90, "strategy": 0.70,
            "executive summary": 0.80, "market analysis": 0.85, "swot": 0.90,
            "budget": 0.60, "forecast": 0.70, "roi": 0.75, "kpi": 0.70,
            "quotation": 0.85, "invoice": 0.75, "tender": 0.90,
            "memo": 0.70, "memorandum": 0.75, "minutes": 0.80,
            "business proposal": 0.90, "project proposal": 0.85,
            "quarterly report": 0.85, "annual report": 0.80, "marketing": 0.75,
            "business": 0.50, "report": 0.40,
        },
        DocumentDomain.TECHNICAL: {
            "api documentation": 0.95, "technical specification": 0.95,
            "system design": 0.90, "architecture": 0.85, "implementation": 0.65,
            "user manual": 0.85, "readme": 0.80, "deployment guide": 0.85,
            "code documentation": 0.90, "specification": 0.80,
            "technical report": 0.85, "srs": 0.90, "requirements document": 0.85,
            "api": 0.75, "documentation": 0.60, "software": 0.50,
            "installation": 0.60, "instructions": 0.40,
        },
        DocumentDomain.ACADEMIC: {
            "thesis": 0.95, "dissertation": 0.95, "research paper": 0.90,
            "literature review": 0.90, "methodology": 0.75, "hypothesis": 0.85,
            "abstract": 0.70, "essay": 0.75, "assignment": 0.65,
            "bibliography": 0.80, "citation": 0.65, "peer review": 0.85,
            "research proposal": 0.90, "academic paper": 0.90,
        },
        DocumentDomain.PERSONAL: {
            "cv": 0.95, "resume": 0.95, "curriculum vitae": 0.95,
            "cover letter": 0.95, "motivation letter": 0.90,
            "personal statement": 0.85, "reference letter": 0.85,
            "recommendation letter": 0.85, "resignation letter": 0.90,
        },
        DocumentDomain.GOVERNMENT: {
            "affidavit": 0.90, "statutory declaration": 0.95,
            "home affairs": 0.90, "sars": 0.85, "uif": 0.85, "sassa": 0.90,
            "municipal": 0.70, "permit application": 0.80, "licence": 0.65,
            "government form": 0.85, "official declaration": 0.85,
            "parliament": 0.90, "submission to parliament": 0.95,
            "government": 0.60, "tender response": 0.80,
        },
        DocumentDomain.HEALTHCARE: {
            "medical report": 0.90, "clinical": 0.85, "diagnosis": 0.80,
            "patient consent": 0.90, "referral letter": 0.85,
            "prescription": 0.75, "hpcsa": 0.90, "medical certificate": 0.90,
            "medical": 0.70, "patient": 0.65, "hospital": 0.70,
            "healthcare": 0.80, "health": 0.50,
        },
        DocumentDomain.FINANCIAL: {
            "financial statement": 0.95, "balance sheet": 0.95,
            "income statement": 0.90, "cash flow": 0.85, "audit report": 0.90,
            "annual report": 0.85, "tax return": 0.85, "ifrs": 0.90,
            "financial report": 0.90, "budget report": 0.80,
        },
        DocumentDomain.CREATIVE: {
            "story": 0.80, "poem": 0.90, "screenplay": 0.90, "script": 0.85,
            "novel": 0.85, "short story": 0.85, "lyrics": 0.85,
            "creative writing": 0.90, "fiction": 0.85,
        },
    }

    # =========================================================================
    # INTENT DETECTION PATTERNS
    # =========================================================================
    
    INTENT_PATTERNS: ClassVar[dict[DocumentIntent, tuple[str, ...]]] = {
        DocumentIntent.CREATE: (
            r"\b(create|write|draft|compose|generate|make|produce)\b",
            r"\b(new|fresh)\s+\w*\s*(document|letter|contract|report)",
        ),
        DocumentIntent.TRANSFORM: (
            r"\b(convert|transform|change|reformat|restructure|rewrite)\b",
            r"\b(turn|make)\s+.*\s+(into|to)\b",
        ),
        DocumentIntent.ANALYZE: (
            r"\b(analyze|analyse|review|evaluate|assess|examine|critique)\b",
        ),
        DocumentIntent.TEMPLATE: (
            r"\btemplate\b",
            r"\b(fill\s+in|complete\s+the)\b",
            r"\breusable\b",
        ),
        DocumentIntent.SUMMARIZE: (
            r"\b(summarize|summarise|condense|shorten|summary)\b",
            r"\bkey\s+points?\b",
            r"\boverview\b",
        ),
        DocumentIntent.EXPAND: (
            r"\b(expand|elaborate|detail|extend)\b",
            r"\bmore\s+detail\b",
            r"\bin[- ]depth\b",
        ),
        DocumentIntent.TRANSLATE: (
            r"\btranslat(e|ion)\b",
            r"\b(in|to|into)\s+(zulu|xhosa|afrikaans|sotho|tswana|venda|tsonga|ndebele|swati|pedi|isizulu|isixhosa)\b",
        ),
        DocumentIntent.FORMALIZE: (
            r"\b(formalize|formalise|make\s+formal)\b",
            r"\bprofessional\s+version\b",
        ),
        DocumentIntent.SIMPLIFY: (
            r"\b(simplify|plain\s+language|easy\s+to\s+understand)\b",
            r"\blayman.?s?\s+terms?\b",
        ),
    }

    # =========================================================================
    # 235B MANDATORY TRIGGERS
    # =========================================================================
    
    MANDATORY_235B: ClassVar[frozenset[str]] = frozenset({
        "constitutional", "litigation", "supreme court", "high court",
        "comprehensive analysis", "detailed report", "white paper",
        "thesis", "dissertation", "compliance audit", "legal opinion",
        "forensic", "expert witness", "exhaustive",
    })

    # SA African languages that require 235B for quality
    AFRICAN_LANGUAGES: ClassVar[frozenset[str]] = frozenset({
        "zu", "zulu", "isizulu",
        "xh", "xhosa", "isixhosa",
        "st", "sotho", "sesotho",
        "tn", "tswana", "setswana",
        "ve", "venda", "tshivenda",
        "ts", "tsonga", "xitsonga",
        "nr", "ndebele", "isindebele",
        "ss", "swati", "siswati",
        "nso", "pedi", "sepedi",
    })

    # =========================================================================
    # COMPLEXITY HINTS
    # =========================================================================
    
    COMPLEXITY_HINTS: ClassVar[dict[DocumentComplexity, tuple[str, ...]]] = {
        DocumentComplexity.TRIVIAL: ("short", "quick", "brief", "simple"),
        DocumentComplexity.SIMPLE: ("standard", "normal", "regular", "basic"),
        DocumentComplexity.MODERATE: ("detailed", "thorough"),
        DocumentComplexity.COMPLEX: ("comprehensive", "complete", "full", "in-depth"),
        DocumentComplexity.EXPERT: ("exhaustive", "expert", "professional-grade"),
    }

    # =========================================================================
    # DOCUMENT TYPE PATTERNS
    # =========================================================================
    
    DOCUMENT_TYPE_PATTERNS: ClassVar[dict[DocumentDomain, dict[str, tuple[str, ...]]]] = {
        DocumentDomain.LEGAL: {
            "contract": ("contract", "agreement"),
            "privacy_policy": ("privacy", "popia"),
            "terms_of_service": ("terms of service", "terms and conditions"),
            "nda": ("nda", "non-disclosure", "confidentiality"),
            "affidavit": ("affidavit", "sworn statement"),
            "employment_contract": ("employment contract", "job contract"),
            "legal_opinion": ("legal opinion", "legal advice"),
        },
        DocumentDomain.BUSINESS: {
            "proposal": ("proposal",),
            "business_plan": ("business plan",),
            "quotation": ("quotation", "quote"),
            "invoice": ("invoice",),
            "report": ("report",),
            "memo": ("memo", "memorandum"),
            "minutes": ("minutes", "meeting notes"),
        },
        DocumentDomain.PERSONAL: {
            "cv": ("cv", "resume", "curriculum vitae"),
            "cover_letter": ("cover letter", "covering letter"),
            "letter": ("letter",),
            "resignation": ("resignation",),
        },
        DocumentDomain.ACADEMIC: {
            "thesis": ("thesis",),
            "dissertation": ("dissertation",),
            "essay": ("essay",),
            "research_paper": ("research paper", "research"),
            "literature_review": ("literature review",),
        },
    }

    # =========================================================================
    # CLASSIFICATION METHODS
    # =========================================================================

    @classmethod
    def classify(cls, content: str, language_code: str) -> DocumentProfile:
        """
        Classify a document request into a complete profile.
        
        Args:
            content: User's document request
            language_code: Detected or specified language code
            
        Returns:
            Immutable DocumentProfile with all classification details
        """
        content_lower = content.lower()
        
        # Step 1: Domain detection with weighted scoring
        domain, confidence, triggers = cls._detect_domain(content_lower)
        
        # Step 2: Intent detection
        intent = cls._detect_intent(content_lower)
        
        # Step 3: Complexity assessment
        complexity = cls._assess_complexity(content_lower, domain, language_code)
        
        # Step 4: Specific document type
        doc_type = cls._infer_document_type(content_lower, domain)
        
        # Step 5: 235B requirement check
        requires_235b = cls._check_235b_requirement(
            content_lower, complexity, language_code
        )
        
        # Step 6: Reasoning mode determination
        reasoning_required = cls._needs_reasoning(domain, intent, complexity)
        
        return DocumentProfile(
            domain=domain,
            intent=intent,
            complexity=complexity,
            document_type=doc_type,
            confidence=confidence,
            triggers_matched=tuple(triggers),
            requires_235b=requires_235b,
            reasoning_required=reasoning_required,
            estimated_tokens=TOKEN_ESTIMATES.get(complexity, 4000),
        )

    @classmethod
    def _detect_domain(
        cls, content: str
    ) -> tuple[DocumentDomain, float, list[str]]:
        """Detect domain using weighted trigger matching"""
        scores: dict[DocumentDomain, float] = {}
        matched: dict[DocumentDomain, list[str]] = {}
        
        for domain, triggers in cls.DOMAIN_TRIGGERS.items():
            score = 0.0
            matches: list[str] = []
            for trigger, weight in triggers.items():
                if trigger in content:
                    score += weight
                    matches.append(trigger)
            if score > 0:
                scores[domain] = score
                matched[domain] = matches
        
        if not scores:
            return DocumentDomain.GENERAL, 0.5, []
        
        # Get highest scoring domain
        best_domain = max(scores, key=lambda d: scores[d])
        confidence = min(scores[best_domain] / 3.0, 1.0)  # Normalize to 0-1
        
        return best_domain, confidence, matched.get(best_domain, [])

    @classmethod
    def _detect_intent(cls, content: str) -> DocumentIntent:
        """Detect user intent from patterns"""
        for intent, patterns in cls.INTENT_PATTERNS.items():
            for pattern in patterns:
                if re.search(pattern, content, re.IGNORECASE):
                    return intent
        return DocumentIntent.CREATE

    @classmethod
    def _assess_complexity(
        cls, content: str, domain: DocumentDomain, language: str
    ) -> DocumentComplexity:
        """Assess complexity from multiple factors"""
        
        # Check explicit hints
        for complexity, hints in cls.COMPLEXITY_HINTS.items():
            if any(hint in content for hint in hints):
                return complexity
        
        # Domain-based defaults for high-stakes
        high_complexity_domains = {
            DocumentDomain.LEGAL,
            DocumentDomain.ACADEMIC,
            DocumentDomain.FINANCIAL,
        }
        if domain in high_complexity_domains:
            return DocumentComplexity.MODERATE
        
        return DocumentComplexity.SIMPLE

    @classmethod
    def _infer_document_type(cls, content: str, domain: DocumentDomain) -> str:
        """Infer specific document type within domain"""
        patterns = cls.DOCUMENT_TYPE_PATTERNS.get(domain, {})
        for doc_type, triggers in patterns.items():
            if any(t in content for t in triggers):
                return doc_type
        return "general"

    @classmethod
    def _check_235b_requirement(
        cls, content: str, complexity: DocumentComplexity, language: str
    ) -> bool:
        """Determine if 235B model is required"""
        
        # Mandatory triggers always require 235B
        if any(trigger in content for trigger in cls.MANDATORY_235B):
            return True
        
        # African languages require 235B for quality
        if language.lower() in cls.AFRICAN_LANGUAGES:
            return True
        
        # Expert complexity requires 235B
        if complexity == DocumentComplexity.EXPERT:
            return True
        
        return False

    @classmethod
    def _needs_reasoning(
        cls, domain: DocumentDomain, intent: DocumentIntent, complexity: DocumentComplexity
    ) -> bool:
        """Determine if thinking/reasoning mode is beneficial"""
        
        # High-stakes domains always benefit from reasoning
        if domain in {DocumentDomain.LEGAL, DocumentDomain.ACADEMIC, DocumentDomain.FINANCIAL}:
            return True
        
        # Analytical intents need reasoning
        if intent in {DocumentIntent.ANALYZE, DocumentIntent.TRANSFORM}:
            return True
        
        # Moderate+ complexity benefits from reasoning
        if complexity in {DocumentComplexity.MODERATE, DocumentComplexity.COMPLEX}:
            return True
        
        return False
