"""
Unit tests for DocumentTemplateEngine.

Tests prompt building, language guidance, SA context injection,
and domain-specific structure generation.
"""

import pytest

from app.tools.document_classifier import DocumentClassifier
from app.tools.document_definitions import (
    DocumentComplexity,
    DocumentDomain,
    DocumentIntent,
    DocumentProfile,
)
from app.tools.document_templates import DocumentTemplateEngine


class TestDocumentTemplateEngine:
    """Test suite for DocumentTemplateEngine."""

    @pytest.fixture
    def engine(self) -> type[DocumentTemplateEngine]:
        """Return the template engine class."""
        return DocumentTemplateEngine

    @pytest.fixture
    def classifier(self) -> DocumentClassifier:
        """Create a classifier instance."""
        return DocumentClassifier()

    def _create_profile(
        self,
        domain: DocumentDomain = DocumentDomain.GENERAL,
        intent: DocumentIntent = DocumentIntent.CREATE,
        complexity: DocumentComplexity = DocumentComplexity.SIMPLE,
        document_type: str = "general",
        requires_235b: bool = False,
    ) -> DocumentProfile:
        """Helper to create a DocumentProfile."""
        return DocumentProfile(
            domain=domain,
            intent=intent,
            complexity=complexity,
            document_type=document_type,
            confidence=0.8,
            triggers_matched=(),
            requires_235b=requires_235b,
            reasoning_required=False,
            estimated_tokens=4000,
        )

    # ─────────────────────────────────────────────────────────────────
    # Core Prompt Building Tests
    # ─────────────────────────────────────────────────────────────────

    def test_build_prompt_returns_string(
        self, engine: type[DocumentTemplateEngine]
    ) -> None:
        """Test that build_prompt returns a string."""
        profile = self._create_profile()
        prompt = engine.build_prompt(
            "Write a letter",
            profile,
            language_code="en",
            language_name="English",
            formality="semi-formal",
            sa_context=True,
        )
        assert isinstance(prompt, str)
        assert len(prompt) > 0

    def test_prompt_contains_user_request(
        self, engine: type[DocumentTemplateEngine]
    ) -> None:
        """Test that prompt includes the user's request."""
        profile = self._create_profile()
        user_request = "Write a letter to my landlord about repairs"
        prompt = engine.build_prompt(
            user_request,
            profile,
            language_code="en",
            language_name="English",
            formality="semi-formal",
            sa_context=True,
        )
        assert user_request in prompt

    def test_prompt_contains_system_core(
        self, engine: type[DocumentTemplateEngine]
    ) -> None:
        """Test that prompt contains system core instructions."""
        profile = self._create_profile()
        prompt = engine.build_prompt(
            "Write a letter",
            profile,
            language_code="en",
            language_name="English",
            formality="formal",
            sa_context=True,
        )
        # Check for key system instructions
        assert "LANGUAGE LOCK" in prompt or "Language Lock" in prompt
        assert "complete" in prompt.lower()

    # ─────────────────────────────────────────────────────────────────
    # Language Guidance Tests
    # ─────────────────────────────────────────────────────────────────

    def test_english_language_guidance(
        self, engine: type[DocumentTemplateEngine]
    ) -> None:
        """Test English language guidance is included."""
        profile = self._create_profile()
        prompt = engine.build_prompt(
            "Write a letter",
            profile,
            language_code="en",
            language_name="English",
            formality="formal",
            sa_context=True,
        )
        assert "English" in prompt

    def test_zulu_language_guidance(
        self, engine: type[DocumentTemplateEngine]
    ) -> None:
        """Test Zulu language guidance is included."""
        profile = self._create_profile()
        prompt = engine.build_prompt(
            "Bhala incwadi",
            profile,
            language_code="zu",
            language_name="isiZulu",
            formality="formal",
            sa_context=True,
        )
        assert "Zulu" in prompt or "isiZulu" in prompt

    def test_xhosa_language_guidance(
        self, engine: type[DocumentTemplateEngine]
    ) -> None:
        """Test Xhosa language guidance is included."""
        profile = self._create_profile()
        prompt = engine.build_prompt(
            "Bhala ileta",
            profile,
            language_code="xh",
            language_name="isiXhosa",
            formality="formal",
            sa_context=True,
        )
        assert "Xhosa" in prompt or "isiXhosa" in prompt

    def test_afrikaans_language_guidance(
        self, engine: type[DocumentTemplateEngine]
    ) -> None:
        """Test Afrikaans language guidance is included."""
        profile = self._create_profile()
        prompt = engine.build_prompt(
            "Skryf 'n brief",
            profile,
            language_code="af",
            language_name="Afrikaans",
            formality="formal",
            sa_context=True,
        )
        assert "Afrikaans" in prompt

    def test_sesotho_language_guidance(
        self, engine: type[DocumentTemplateEngine]
    ) -> None:
        """Test Sesotho language guidance is included."""
        profile = self._create_profile()
        prompt = engine.build_prompt(
            "Ngola lengolo",
            profile,
            language_code="st",
            language_name="Sesotho",
            formality="formal",
            sa_context=True,
        )
        assert "Sesotho" in prompt or "Sotho" in prompt

    def test_all_11_languages_have_guidance(
        self, engine: type[DocumentTemplateEngine]
    ) -> None:
        """Test that all 11 SA official languages produce prompts."""
        sa_languages = [
            ("en", "English"),
            ("af", "Afrikaans"),
            ("zu", "isiZulu"),
            ("xh", "isiXhosa"),
            ("st", "Sesotho"),
            ("tn", "Setswana"),
            ("ve", "Tshivenda"),
            ("ts", "Xitsonga"),
            ("nr", "isiNdebele"),
            ("ss", "siSwati"),
            ("nso", "Sepedi"),
        ]
        profile = self._create_profile()
        for code, name in sa_languages:
            prompt = engine.build_prompt(
                "Write a letter",
                profile,
                language_code=code,
                language_name=name,
                formality="formal",
                sa_context=True,
            )
            assert len(prompt) > 100, f"Missing guidance for {code}"

    # ─────────────────────────────────────────────────────────────────
    # SA Context Tests
    # ─────────────────────────────────────────────────────────────────

    def test_legal_includes_sa_context(
        self, engine: type[DocumentTemplateEngine]
    ) -> None:
        """Test that LEGAL domain includes SA legal context."""
        profile = self._create_profile(domain=DocumentDomain.LEGAL)
        prompt = engine.build_prompt(
            "Draft a contract",
            profile,
            language_code="en",
            language_name="English",
            formality="formal",
            sa_context=True,
        )
        # Should mention SA legal frameworks
        assert any(
            framework in prompt
            for framework in ["POPIA", "CPA", "LRA", "BCEA", "NCA", "South Africa"]
        )

    def test_sa_context_can_be_disabled(
        self, engine: type[DocumentTemplateEngine]
    ) -> None:
        """Test that SA context can be disabled."""
        profile = self._create_profile()
        prompt_with = engine.build_prompt(
            "Write a letter",
            profile,
            language_code="en",
            language_name="English",
            formality="formal",
            sa_context=True,
        )
        prompt_without = engine.build_prompt(
            "Write a letter",
            profile,
            language_code="en",
            language_name="English",
            formality="formal",
            sa_context=False,
        )
        # SA context prompt should have POPIA mention
        assert "POPIA" in prompt_with
        # Non-SA context should not
        assert "POPIA" not in prompt_without

    # ─────────────────────────────────────────────────────────────────
    # Domain Structure Tests
    # ─────────────────────────────────────────────────────────────────

    def test_legal_domain_structure(
        self, engine: type[DocumentTemplateEngine]
    ) -> None:
        """Test that LEGAL domain has appropriate structure guidance."""
        profile = self._create_profile(domain=DocumentDomain.LEGAL)
        prompt = engine.build_prompt(
            "Draft a contract",
            profile,
            language_code="en",
            language_name="English",
            formality="formal",
            sa_context=True,
        )
        legal_terms = ["clause", "section", "party", "agreement", "legal"]
        assert any(term in prompt.lower() for term in legal_terms)

    def test_business_domain_structure(
        self, engine: type[DocumentTemplateEngine]
    ) -> None:
        """Test that BUSINESS domain has appropriate structure guidance."""
        profile = self._create_profile(domain=DocumentDomain.BUSINESS)
        prompt = engine.build_prompt(
            "Write a proposal",
            profile,
            language_code="en",
            language_name="English",
            formality="formal",
            sa_context=True,
        )
        business_terms = ["executive", "objective", "conclusion", "recommendation", "business"]
        assert any(term in prompt.lower() for term in business_terms)

    def test_technical_domain_structure(
        self, engine: type[DocumentTemplateEngine]
    ) -> None:
        """Test that TECHNICAL domain has appropriate structure guidance."""
        profile = self._create_profile(domain=DocumentDomain.TECHNICAL)
        prompt = engine.build_prompt(
            "Write documentation",
            profile,
            language_code="en",
            language_name="English",
            formality="formal",
            sa_context=True,
        )
        tech_terms = ["code", "example", "specification", "documentation", "technical"]
        assert any(term in prompt.lower() for term in tech_terms)

    def test_academic_domain_structure(
        self, engine: type[DocumentTemplateEngine]
    ) -> None:
        """Test that ACADEMIC domain has appropriate structure guidance."""
        profile = self._create_profile(domain=DocumentDomain.ACADEMIC)
        prompt = engine.build_prompt(
            "Write a research paper",
            profile,
            language_code="en",
            language_name="English",
            formality="formal",
            sa_context=True,
        )
        academic_terms = ["abstract", "introduction", "methodology", "reference", "citation", "academic"]
        assert any(term in prompt.lower() for term in academic_terms)

    # ─────────────────────────────────────────────────────────────────
    # Formality Tests
    # ─────────────────────────────────────────────────────────────────

    def test_formal_style_guidance(
        self, engine: type[DocumentTemplateEngine]
    ) -> None:
        """Test that formal style includes appropriate guidance."""
        profile = self._create_profile()
        prompt = engine.build_prompt(
            "Write a letter",
            profile,
            language_code="en",
            language_name="English",
            formality="formal",
            sa_context=True,
        )
        formal_terms = ["formal", "professional", "structure", "precise"]
        assert any(term in prompt.lower() for term in formal_terms)

    def test_casual_style_guidance(
        self, engine: type[DocumentTemplateEngine]
    ) -> None:
        """Test that casual style includes appropriate guidance."""
        profile = self._create_profile()
        prompt = engine.build_prompt(
            "Write a message",
            profile,
            language_code="en",
            language_name="English",
            formality="casual",
            sa_context=True,
        )
        casual_terms = ["casual", "informal", "conversational", "friendly", "relaxed"]
        assert any(term in prompt.lower() for term in casual_terms)

    # ─────────────────────────────────────────────────────────────────
    # Custom Instructions Tests
    # ─────────────────────────────────────────────────────────────────

    def test_custom_instructions_included(
        self, engine: type[DocumentTemplateEngine]
    ) -> None:
        """Test that custom instructions are included in prompt."""
        profile = self._create_profile()
        custom = "Include a section about warranty terms"
        prompt = engine.build_prompt(
            "Write a letter",
            profile,
            language_code="en",
            language_name="English",
            formality="formal",
            sa_context=True,
            custom_instructions=custom,
        )
        assert custom in prompt
        assert "ADDITIONAL REQUIREMENTS" in prompt

    def test_no_custom_instructions(
        self, engine: type[DocumentTemplateEngine]
    ) -> None:
        """Test that prompt works without custom instructions."""
        profile = self._create_profile()
        prompt = engine.build_prompt(
            "Write a letter",
            profile,
            language_code="en",
            language_name="English",
            formality="formal",
            sa_context=True,
            custom_instructions=None,
        )
        assert "ADDITIONAL REQUIREMENTS" not in prompt

    # ─────────────────────────────────────────────────────────────────
    # Integration with Classifier Tests
    # ─────────────────────────────────────────────────────────────────

    def test_classifier_to_template_integration(
        self, engine: type[DocumentTemplateEngine], classifier: DocumentClassifier
    ) -> None:
        """Test that classifier output works with template engine."""
        requests = [
            ("Draft a POPIA compliance policy", "en", "English"),
            ("Write a business proposal", "en", "English"),
            ("Create a medical report", "en", "English"),
            ("Bhala incwadi yomsebenzi", "zu", "isiZulu"),
        ]
        for request, lang_code, lang_name in requests:
            profile = classifier.classify(request, lang_code)
            prompt = engine.build_prompt(
                request,
                profile,
                language_code=lang_code,
                language_name=lang_name,
                formality="formal",
                sa_context=True,
            )
            assert isinstance(prompt, str)
            assert len(prompt) > 100
            assert request in prompt

    # ─────────────────────────────────────────────────────────────────
    # Edge Cases
    # ─────────────────────────────────────────────────────────────────

    def test_empty_request(self, engine: type[DocumentTemplateEngine]) -> None:
        """Test handling of empty request."""
        profile = self._create_profile()
        prompt = engine.build_prompt(
            "",
            profile,
            language_code="en",
            language_name="English",
            formality="formal",
            sa_context=True,
        )
        assert isinstance(prompt, str)

    def test_very_long_request(
        self, engine: type[DocumentTemplateEngine]
    ) -> None:
        """Test handling of very long request."""
        long_request = "Write a comprehensive document " * 100
        profile = self._create_profile()
        prompt = engine.build_prompt(
            long_request,
            profile,
            language_code="en",
            language_name="English",
            formality="formal",
            sa_context=True,
        )
        # Should truncate in topic summary but include full request
        assert "comprehensive document" in prompt

    def test_special_characters_in_request(
        self, engine: type[DocumentTemplateEngine]
    ) -> None:
        """Test handling of special characters."""
        special_request = "Write about R10,000 contract with 50% clause & §15.2 reference"
        profile = self._create_profile()
        prompt = engine.build_prompt(
            special_request,
            profile,
            language_code="en",
            language_name="English",
            formality="formal",
            sa_context=True,
        )
        assert "R10,000" in prompt
        assert "50%" in prompt


class TestPromptComposition:
    """Test prompt composition and block assembly."""

    def test_prompt_has_clear_sections(self) -> None:
        """Test that prompt has distinguishable sections."""
        profile = DocumentProfile(
            domain=DocumentDomain.LEGAL,
            intent=DocumentIntent.CREATE,
            complexity=DocumentComplexity.COMPLEX,
            document_type="contract",
            confidence=0.9,
            triggers_matched=("contract",),
            requires_235b=True,
            reasoning_required=True,
            estimated_tokens=15000,
        )
        prompt = DocumentTemplateEngine.build_prompt(
            "Draft a contract",
            profile,
            language_code="en",
            language_name="English",
            formality="formal",
            sa_context=True,
        )
        # Should have multiple newlines indicating sections
        assert prompt.count("\n") >= 3

    def test_prompt_ends_with_output_instruction(self) -> None:
        """Test that prompt ends with output instruction."""
        profile = DocumentProfile(
            domain=DocumentDomain.GENERAL,
            intent=DocumentIntent.CREATE,
            complexity=DocumentComplexity.SIMPLE,
            document_type="general",
            confidence=0.8,
            triggers_matched=(),
            requires_235b=False,
            reasoning_required=False,
            estimated_tokens=4000,
        )
        prompt = DocumentTemplateEngine.build_prompt(
            "Write a letter to my neighbor",
            profile,
            language_code="en",
            language_name="English",
            formality="semi-formal",
            sa_context=True,
        )
        assert "OUTPUT INSTRUCTION" in prompt

    def test_prompt_not_overly_verbose(self) -> None:
        """Test that prompt is not excessively long."""
        profile = DocumentProfile(
            domain=DocumentDomain.GENERAL,
            intent=DocumentIntent.CREATE,
            complexity=DocumentComplexity.TRIVIAL,
            document_type="general",
            confidence=0.8,
            triggers_matched=(),
            requires_235b=False,
            reasoning_required=False,
            estimated_tokens=1500,
        )
        prompt = DocumentTemplateEngine.build_prompt(
            "Write a note",
            profile,
            language_code="en",
            language_name="English",
            formality="casual",
            sa_context=False,
        )
        # Simple prompts should be reasonable length
        assert len(prompt) < 10000
