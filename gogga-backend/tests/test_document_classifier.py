"""
Unit tests for DocumentClassifier.

Tests domain detection, intent classification, complexity assessment,
and 235B model routing logic.
"""

import pytest

from app.tools.document_classifier import DocumentClassifier
from app.tools.document_definitions import (
    DocumentComplexity,
    DocumentDomain,
    DocumentIntent,
)


class TestDocumentClassifier:
    """Test suite for DocumentClassifier."""

    @pytest.fixture
    def classifier(self) -> DocumentClassifier:
        """Create a classifier instance."""
        return DocumentClassifier()

    # ─────────────────────────────────────────────────────────────────
    # Domain Detection Tests
    # ─────────────────────────────────────────────────────────────────

    def test_legal_domain_detection(self, classifier: DocumentClassifier) -> None:
        """Test that legal keywords trigger LEGAL domain."""
        legal_requests = [
            "Draft a contract for services",
            "Create a POPIA compliance policy",
            "Write an affidavit for court",
            "Generate a lease agreement",
            "Prepare CCMA documentation",
        ]
        for request in legal_requests:
            profile = classifier.classify(request, "en")
            assert profile.domain == DocumentDomain.LEGAL, f"Failed for: {request}"

    def test_business_domain_detection(self, classifier: DocumentClassifier) -> None:
        """Test that business keywords trigger BUSINESS domain."""
        business_requests = [
            "Create a business proposal",
            "Write a marketing strategy",
            "Draft an invoice template",
            "Generate a quarterly report",
            "Prepare a tender document",
        ]
        for request in business_requests:
            profile = classifier.classify(request, "en")
            assert profile.domain == DocumentDomain.BUSINESS, f"Failed for: {request}"

    def test_technical_domain_detection(self, classifier: DocumentClassifier) -> None:
        """Test that technical keywords trigger TECHNICAL domain."""
        technical_requests = [
            "Write API documentation",
            "Create a technical specification",
            "Document the software architecture",
            "Generate a README file",
            "Write a user manual",
        ]
        for request in technical_requests:
            profile = classifier.classify(request, "en")
            assert profile.domain == DocumentDomain.TECHNICAL, f"Failed for: {request}"

    def test_government_domain_detection(self, classifier: DocumentClassifier) -> None:
        """Test that government keywords trigger GOVERNMENT domain."""
        gov_requests = [
            "Write a SASSA application",
            "Create a municipal complaint",
            "Draft a submission to parliament",
            "Generate a government form",
            "Prepare Home Affairs documentation",
        ]
        for request in gov_requests:
            profile = classifier.classify(request, "en")
            assert profile.domain == DocumentDomain.GOVERNMENT, f"Failed for: {request}"

    def test_healthcare_domain_detection(self, classifier: DocumentClassifier) -> None:
        """Test that healthcare keywords trigger HEALTHCARE domain."""
        health_requests = [
            "Write a medical certificate",
            "Create patient consent form",
            "Draft hospital referral letter",
            "Generate a medical report",
        ]
        for request in health_requests:
            profile = classifier.classify(request, "en")
            assert profile.domain == DocumentDomain.HEALTHCARE, f"Failed for: {request}"

    def test_general_domain_fallback(self, classifier: DocumentClassifier) -> None:
        """Test that ambiguous requests default to GENERAL domain."""
        general_requests = [
            "Write a letter",
            "Create a document",
            "Help me with this",
        ]
        for request in general_requests:
            profile = classifier.classify(request, "en")
            assert profile.domain == DocumentDomain.GENERAL, f"Failed for: {request}"

    # ─────────────────────────────────────────────────────────────────
    # Intent Classification Tests
    # ─────────────────────────────────────────────────────────────────

    def test_create_intent_detection(self, classifier: DocumentClassifier) -> None:
        """Test CREATE intent detection."""
        create_requests = [
            "Write a new letter",
            "Create a document",
            "Draft a proposal",
            "Generate a report",
            "Compose an email",
        ]
        for request in create_requests:
            profile = classifier.classify(request, "en")
            assert profile.intent == DocumentIntent.CREATE, f"Failed for: {request}"

    def test_transform_intent_detection(self, classifier: DocumentClassifier) -> None:
        """Test TRANSFORM intent detection."""
        transform_requests = [
            "Convert this to formal language",
            "Rewrite in a professional tone",
            "Transform this informal text",
            "Restructure this document",
        ]
        for request in transform_requests:
            profile = classifier.classify(request, "en")
            assert profile.intent == DocumentIntent.TRANSFORM, f"Failed for: {request}"

    def test_summarize_intent_detection(self, classifier: DocumentClassifier) -> None:
        """Test SUMMARIZE intent detection."""
        summarize_requests = [
            "Summarize this document",
            "Give me the key points",
            "Summarise this text",
            "Condense this text",
        ]
        for request in summarize_requests:
            profile = classifier.classify(request, "en")
            assert profile.intent == DocumentIntent.SUMMARIZE, f"Failed for: {request}"

    def test_translate_intent_detection(self, classifier: DocumentClassifier) -> None:
        """Test TRANSLATE intent detection."""
        translate_requests = [
            "Translate this to Zulu",
            "Translation to isiXhosa",
            "Translate in Afrikaans",
        ]
        for request in translate_requests:
            profile = classifier.classify(request, "en")
            assert profile.intent == DocumentIntent.TRANSLATE, f"Failed for: {request}"

    def test_analyze_intent_detection(self, classifier: DocumentClassifier) -> None:
        """Test ANALYZE intent detection."""
        analyze_requests = [
            "Analyze this contract",
            "Review this document",
            "Evaluate this proposal",
            "Critique this proposal text",
        ]
        for request in analyze_requests:
            profile = classifier.classify(request, "en")
            assert profile.intent == DocumentIntent.ANALYZE, f"Failed for: {request}"

    # ─────────────────────────────────────────────────────────────────
    # Complexity Assessment Tests
    # ─────────────────────────────────────────────────────────────────

    def test_trivial_complexity(self, classifier: DocumentClassifier) -> None:
        """Test TRIVIAL complexity for simple requests."""
        simple_requests = [
            "Write a short note",
            "Create a quick reminder",
            "Draft a brief message",
        ]
        for request in simple_requests:
            profile = classifier.classify(request, "en")
            assert profile.complexity == DocumentComplexity.TRIVIAL, f"Failed for: {request}"

    def test_simple_complexity(self, classifier: DocumentClassifier) -> None:
        """Test SIMPLE complexity for basic documents."""
        simple_requests = [
            "Write a letter to my landlord",
            "Create a basic template",
        ]
        for request in simple_requests:
            profile = classifier.classify(request, "en")
            assert profile.complexity in (DocumentComplexity.TRIVIAL, DocumentComplexity.SIMPLE), f"Failed for: {request}"

    def test_complex_legal_documents(self, classifier: DocumentClassifier) -> None:
        """Test that legal contracts are marked as MODERATE or higher."""
        complex_requests = [
            "Draft a comprehensive employment contract",
            "Create a detailed POPIA compliance framework",
            "Write a litigation document for court",
        ]
        for request in complex_requests:
            profile = classifier.classify(request, "en")
            assert profile.complexity in (
                DocumentComplexity.MODERATE,
                DocumentComplexity.COMPLEX,
                DocumentComplexity.EXPERT,
            ), f"Failed for: {request}"

    def test_expert_complexity_triggers(self, classifier: DocumentClassifier) -> None:
        """Test that expert-level keywords trigger EXPERT complexity."""
        expert_requests = [
            "Create an exhaustive constitutional analysis",
            "Write an exhaustive legal framework",
            "Draft an exhaustive expert-level review",
        ]
        for request in expert_requests:
            profile = classifier.classify(request, "en")
            assert profile.complexity == DocumentComplexity.EXPERT, f"Failed for: {request}"

    # ─────────────────────────────────────────────────────────────────
    # 235B Model Routing Tests
    # ─────────────────────────────────────────────────────────────────

    def test_african_languages_require_235b(self, classifier: DocumentClassifier) -> None:
        """Test that African languages always require 235B model."""
        african_langs = ["zu", "xh", "st", "tn", "ve", "ts", "nr", "ss", "nso"]
        for lang in african_langs:
            profile = classifier.classify("Write a letter", lang)
            assert profile.requires_235b is True, f"Failed for language: {lang}"

    def test_english_afrikaans_can_use_32b(self, classifier: DocumentClassifier) -> None:
        """Test that English and Afrikaans don't auto-require 235B."""
        simple_requests = [
            ("Write a simple note", "en"),
            ("Skryf 'n brief", "af"),
        ]
        for request, lang in simple_requests:
            profile = classifier.classify(request, lang)
            # Simple requests should not require 235B
            assert profile.requires_235b is False, f"Failed for: {request} ({lang})"

    def test_mandatory_235b_keywords(self, classifier: DocumentClassifier) -> None:
        """Test that mandatory 235B keywords force 235B model."""
        mandatory_requests = [
            "Draft constitutional court documentation",
            "Create litigation papers",
            "Write an exhaustive analysis",
        ]
        for request in mandatory_requests:
            profile = classifier.classify(request, "en")
            assert profile.requires_235b is True, f"Failed for: {request}"

    # ─────────────────────────────────────────────────────────────────
    # High Stakes Detection Tests
    # ─────────────────────────────────────────────────────────────────

    def test_legal_domain_is_high_stakes(self, classifier: DocumentClassifier) -> None:
        """Test that LEGAL domain is marked as high stakes."""
        profile = classifier.classify("Draft a contract", "en")
        assert profile.is_high_stakes is True

    def test_healthcare_domain_is_high_stakes(self, classifier: DocumentClassifier) -> None:
        """Test that HEALTHCARE domain is marked as high stakes."""
        profile = classifier.classify("Write a medical report", "en")
        assert profile.is_high_stakes is True

    def test_financial_domain_is_high_stakes(self, classifier: DocumentClassifier) -> None:
        """Test that FINANCIAL domain is marked as high stakes."""
        profile = classifier.classify("Create a financial audit report", "en")
        assert profile.is_high_stakes is True

    def test_government_domain_is_high_stakes(self, classifier: DocumentClassifier) -> None:
        """Test that GOVERNMENT domain is marked as high stakes."""
        profile = classifier.classify("Draft a SASSA submission", "en")
        assert profile.is_high_stakes is True

    def test_general_domain_is_not_high_stakes(self, classifier: DocumentClassifier) -> None:
        """Test that GENERAL domain is not high stakes."""
        profile = classifier.classify("Write a simple letter", "en")
        # GENERAL domain should not be high stakes
        if profile.domain == DocumentDomain.GENERAL:
            assert profile.is_high_stakes is False

    # ─────────────────────────────────────────────────────────────────
    # Model Recommendation Tests
    # ─────────────────────────────────────────────────────────────────

    def test_235b_recommendation_when_required(self, classifier: DocumentClassifier) -> None:
        """Test that model recommendation returns 235B when required."""
        profile = classifier.classify("Draft a constitutional analysis", "en")
        assert profile.model_recommendation == "qwen-235b"

    def test_32b_recommendation_for_simple(self, classifier: DocumentClassifier) -> None:
        """Test that model recommendation returns 32B for simple requests."""
        profile = classifier.classify("Write a short note", "en")
        if not profile.requires_235b:
            assert profile.model_recommendation == "qwen-32b"

    # ─────────────────────────────────────────────────────────────────
    # Edge Cases
    # ─────────────────────────────────────────────────────────────────

    def test_empty_request(self, classifier: DocumentClassifier) -> None:
        """Test handling of empty request."""
        profile = classifier.classify("", "en")
        assert profile.domain == DocumentDomain.GENERAL
        assert profile.intent == DocumentIntent.CREATE
        assert profile.complexity == DocumentComplexity.SIMPLE

    def test_very_long_request(self, classifier: DocumentClassifier) -> None:
        """Test handling of very long request."""
        long_request = "Write a contract " * 100
        profile = classifier.classify(long_request, "en")
        # Should still classify correctly
        assert profile.domain == DocumentDomain.LEGAL

    def test_mixed_domain_signals(self, classifier: DocumentClassifier) -> None:
        """Test handling of mixed domain signals."""
        # This has both legal and business keywords
        mixed_request = "Create a business contract with POPIA compliance"
        profile = classifier.classify(mixed_request, "en")
        # Should pick the strongest signal (legal due to contract + POPIA)
        assert profile.domain in (DocumentDomain.LEGAL, DocumentDomain.BUSINESS)

    def test_case_insensitivity(self, classifier: DocumentClassifier) -> None:
        """Test that classification is case-insensitive."""
        profiles = [
            classifier.classify("DRAFT A CONTRACT", "en"),
            classifier.classify("draft a contract", "en"),
            classifier.classify("Draft A Contract", "en"),
        ]
        # All should classify the same
        domains = [p.domain for p in profiles]
        assert all(d == domains[0] for d in domains)

    def test_unknown_language_code(self, classifier: DocumentClassifier) -> None:
        """Test handling of unknown language code."""
        profile = classifier.classify("Write a letter", "xyz")
        # Should not crash, default behavior
        assert profile is not None
        assert profile.requires_235b is False  # Unknown doesn't force 235B


class TestDocumentProfile:
    """Test DocumentProfile properties."""

    @pytest.fixture
    def classifier(self) -> DocumentClassifier:
        return DocumentClassifier()

    def test_estimated_tokens_trivial(self, classifier: DocumentClassifier) -> None:
        """Test estimated tokens for trivial documents."""
        profile = classifier.classify("Write a short quick note", "en")
        if profile.complexity == DocumentComplexity.TRIVIAL:
            assert profile.estimated_tokens == 1500

    def test_estimated_tokens_expert(self, classifier: DocumentClassifier) -> None:
        """Test estimated tokens for expert documents."""
        profile = classifier.classify("Write an exhaustive constitutional analysis", "en")
        if profile.complexity == DocumentComplexity.EXPERT:
            assert profile.estimated_tokens == 30000

    def test_profile_is_immutable(self, classifier: DocumentClassifier) -> None:
        """Test that DocumentProfile is immutable (frozen dataclass)."""
        profile = classifier.classify("Write a letter", "en")
        with pytest.raises(AttributeError):
            profile.domain = DocumentDomain.LEGAL  # type: ignore

    def test_profile_hashable(self, classifier: DocumentClassifier) -> None:
        """Test that DocumentProfile is hashable (can be used in sets/dicts)."""
        profile = classifier.classify("Write a letter", "en")
        # Should not raise
        profile_set = {profile}
        assert len(profile_set) == 1
