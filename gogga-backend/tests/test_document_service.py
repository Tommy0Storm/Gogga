"""
Integration tests for DocumentService.

Tests the full document generation flow with mocked AI responses.
"""

import pytest
from unittest.mock import AsyncMock, patch

from app.services.document_service import (
    DocumentService,
    LANGUAGE_CODE_TO_NAME,
    GenerationResult,
)
from app.tools.document_classifier import DocumentClassifier
from app.tools.document_definitions import (
    DocumentComplexity,
    DocumentDomain,
    DocumentIntent,
    DocumentProfile,
    DocumentToolInput,
    DocumentToolOutput,
)


class TestDocumentService:
    """Integration tests for DocumentService."""

    @pytest.fixture
    def service(self) -> DocumentService:
        """Create a document service instance."""
        # Reset singleton for testing
        DocumentService._instance = None
        return DocumentService()

    def _mock_generation_result(
        self,
        content: str,
        model: str = "qwen-3-32b",
        provider: str = "cerebras",
        input_tokens: int = 150,
        output_tokens: int = 500,
    ) -> GenerationResult:
        """Create a mock GenerationResult for testing."""
        return GenerationResult(
            content=content,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            reasoning_tokens=0,
            model=model,
            provider=provider,
        )

    # ─────────────────────────────────────────────────────────────────
    # Service Initialization Tests
    # ─────────────────────────────────────────────────────────────────

    def test_service_singleton(self) -> None:
        """Test that DocumentService is a singleton."""
        DocumentService._instance = None
        service1 = DocumentService()
        service2 = DocumentService()
        assert service1 is service2

    def test_service_has_classifier(self, service: DocumentService) -> None:
        """Test that service has a classifier."""
        assert hasattr(service, "_classifier")
        assert isinstance(service._classifier, DocumentClassifier)

    def test_service_has_template_engine(self, service: DocumentService) -> None:
        """Test that service has a template engine."""
        assert hasattr(service, "_template_engine")

    # ─────────────────────────────────────────────────────────────────
    # Model Routing Tests
    # ─────────────────────────────────────────────────────────────────

    def test_expert_complexity_routes_to_235b(self, service: DocumentService) -> None:
        """Test that EXPERT complexity routes to 235B model."""
        profile = DocumentProfile(
            domain=DocumentDomain.LEGAL,
            intent=DocumentIntent.CREATE,
            complexity=DocumentComplexity.EXPERT,
            document_type="contract",
            confidence=0.9,
            triggers_matched=("contract",),
            requires_235b=True,
            reasoning_required=True,
            estimated_tokens=30000,
        )
        config = service._get_generation_config(profile, "jigga")
        assert "235b" in config["model"].lower() or "qwen3-235b" in config["model"]
        assert config["max_tokens"] == 30000

    def test_african_language_routes_to_235b(self, service: DocumentService) -> None:
        """Test that African languages route to 235B."""
        profile = DocumentProfile(
            domain=DocumentDomain.GENERAL,
            intent=DocumentIntent.CREATE,
            complexity=DocumentComplexity.SIMPLE,
            document_type="general",
            confidence=0.8,
            triggers_matched=(),
            requires_235b=True,  # Zulu requires 235B
            reasoning_required=False,
            estimated_tokens=4000,
        )
        config = service._get_generation_config(profile, "jive")
        assert "235b" in config["model"].lower() or "qwen3-235b" in config["model"]

    def test_free_tier_always_uses_235b(self, service: DocumentService) -> None:
        """Test that FREE tier always uses 235B (OpenRouter)."""
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
        config = service._get_generation_config(profile, "free")
        assert config["provider"] == "openrouter"

    def test_jive_tier_can_use_cerebras(self, service: DocumentService) -> None:
        """Test that JIVE tier can use Cerebras for simple docs."""
        profile = DocumentProfile(
            domain=DocumentDomain.GENERAL,
            intent=DocumentIntent.CREATE,
            complexity=DocumentComplexity.SIMPLE,
            document_type="general",
            confidence=0.8,
            triggers_matched=(),
            requires_235b=False,
            reasoning_required=True,
            estimated_tokens=4000,
        )
        config = service._get_generation_config(profile, "jive")
        # Should use Cerebras for JIVE with reasoning
        assert config["provider"] == "cerebras"

    # ─────────────────────────────────────────────────────────────────
    # Temperature Settings Tests
    # ─────────────────────────────────────────────────────────────────

    def test_cerebras_uses_safe_temperature(self, service: DocumentService) -> None:
        """Test that Cerebras uses temperature >= 0.6 for thinking mode."""
        profile = DocumentProfile(
            domain=DocumentDomain.GENERAL,
            intent=DocumentIntent.CREATE,
            complexity=DocumentComplexity.SIMPLE,
            document_type="general",
            confidence=0.8,
            triggers_matched=(),
            requires_235b=False,
            reasoning_required=True,
            estimated_tokens=4000,
        )
        config = service._get_generation_config(profile, "jive")
        if config["provider"] == "cerebras" and config.get("thinking_mode"):
            assert config["temperature"] >= 0.6

    def test_235b_uses_appropriate_temp(self, service: DocumentService) -> None:
        """Test that 235B uses appropriate temperature."""
        profile = DocumentProfile(
            domain=DocumentDomain.GENERAL,
            intent=DocumentIntent.CREATE,
            complexity=DocumentComplexity.EXPERT,
            document_type="general",
            confidence=0.9,
            triggers_matched=(),
            requires_235b=True,
            reasoning_required=True,
            estimated_tokens=30000,
        )
        config = service._get_generation_config(profile, "jigga")
        assert config["temperature"] >= 0.6

    # ─────────────────────────────────────────────────────────────────
    # Document Generation Tests (Mocked)
    # ─────────────────────────────────────────────────────────────────

    @pytest.mark.asyncio
    async def test_generate_legal_document(self, service: DocumentService) -> None:
        """Test generating a legal document."""
        with patch.object(
            service, "_generate_document", new_callable=AsyncMock
        ) as mock_gen, patch.object(
            service, "_track_generation_cost", new_callable=AsyncMock
        ) as mock_cost:
            mock_gen.return_value = self._mock_generation_result(
                "# Contract\n\nThis contract is between...",
                model="qwen-3-32b",
                provider="cerebras",
            )
            mock_cost.return_value = {"usd": 0.0001, "zar": 0.002}

            input_data = DocumentToolInput(
                content="Draft a service contract for cleaning services",
                document_type="contract",
                language="en",
                formality="formal",
                include_sa_context=True,
            )
            
            result = await service.generate(input_data, "jigga")

            assert isinstance(result, DocumentToolOutput)
            assert result.domain == "legal"
            assert result.content is not None
            # Verify token tracking fields are present
            assert result.input_tokens >= 0
            assert result.output_tokens >= 0

    @pytest.mark.asyncio
    async def test_generate_business_document(self, service: DocumentService) -> None:
        """Test generating a business document."""
        with patch.object(
            service, "_generate_document", new_callable=AsyncMock
        ) as mock_gen, patch.object(
            service, "_track_generation_cost", new_callable=AsyncMock
        ) as mock_cost:
            mock_gen.return_value = self._mock_generation_result(
                "# Business Proposal\n\nExecutive Summary...",
                model="qwen-3-32b",
                provider="cerebras",
            )
            mock_cost.return_value = {"usd": 0.0001, "zar": 0.002}

            input_data = DocumentToolInput(
                content="Write a business proposal for a new marketing campaign",
                language="en",
                formality="formal",
                include_sa_context=True,
            )
            
            result = await service.generate(input_data, "jive")

            assert isinstance(result, DocumentToolOutput)
            assert result.domain == "business"

    @pytest.mark.asyncio
    async def test_generate_with_language_intel(self, service: DocumentService) -> None:
        """Test generating with pre-detected language."""
        with patch.object(
            service, "_generate_document", new_callable=AsyncMock
        ) as mock_gen, patch.object(
            service, "_track_generation_cost", new_callable=AsyncMock
        ) as mock_cost:
            mock_gen.return_value = self._mock_generation_result(
                "# Incwadi\n\nMnumzane othandekayo...",
                model="qwen/qwen3-235b-a22b-instruct-2507",
                provider="openrouter",
            )
            mock_cost.return_value = {"usd": 0.0002, "zar": 0.004}

            input_data = DocumentToolInput(
                content="Bhala incwadi kubaqashi wami mayelana nokulungiswa kwendlu",
                formality="formal",
                include_sa_context=True,
            )
            
            language_intel = {
                "code": "zu",
                "name": "isiZulu",
                "confidence": 0.95,
            }
            
            result = await service.generate(input_data, "jive", language_intel)

            assert isinstance(result, DocumentToolOutput)
            assert result.language == "isiZulu"

    @pytest.mark.asyncio
    async def test_generate_returns_metadata(self, service: DocumentService) -> None:
        """Test that generation returns complete metadata."""
        with patch.object(
            service, "_generate_document", new_callable=AsyncMock
        ) as mock_gen, patch.object(
            service, "_track_generation_cost", new_callable=AsyncMock
        ) as mock_cost:
            mock_gen.return_value = self._mock_generation_result(
                "# Document\n\nContent here...",
                model="qwen-3-32b",
                provider="cerebras",
                input_tokens=100,
                output_tokens=200,
            )
            mock_cost.return_value = {"usd": 0.00005, "zar": 0.001}

            input_data = DocumentToolInput(
                content="Write a general document for my records",
                language="en",
                formality="semi-formal",
                include_sa_context=True,
            )
            
            result = await service.generate(input_data, "jive")

            assert hasattr(result, "domain")
            assert hasattr(result, "document_type")
            assert hasattr(result, "language")
            assert hasattr(result, "word_count")
            # New token tracking fields
            assert hasattr(result, "input_tokens")
            assert hasattr(result, "output_tokens")
            assert hasattr(result, "cost_usd")
            assert hasattr(result, "cost_zar")
            assert result.input_tokens == 100
            assert result.output_tokens == 200
            assert hasattr(result, "model_used")
            assert hasattr(result, "thinking_mode")

    # ─────────────────────────────────────────────────────────────────
    # Error Handling Tests
    # ─────────────────────────────────────────────────────────────────

    @pytest.mark.asyncio
    async def test_handle_generation_error(self, service: DocumentService) -> None:
        """Test handling of generation errors."""
        with patch.object(
            service, "_generate_document", new_callable=AsyncMock
        ) as mock_gen:
            mock_gen.side_effect = Exception("API Error")

            input_data = DocumentToolInput(
                content="Write a document that will fail",
                language="en",
                formality="formal",
                include_sa_context=True,
            )

            with pytest.raises(Exception, match="API Error"):
                await service.generate(input_data, "jive")

    # ─────────────────────────────────────────────────────────────────
    # Title Extraction Tests
    # ─────────────────────────────────────────────────────────────────

    def test_extract_title_from_markdown_heading(self, service: DocumentService) -> None:
        """Test extracting title from markdown heading."""
        content = "# My Document Title\n\nContent here..."
        title = service._extract_title(content)
        assert title == "My Document Title"

    def test_extract_title_from_first_line(self, service: DocumentService) -> None:
        """Test extracting title from first line when no heading."""
        content = "My Document Title\n\nContent here..."
        title = service._extract_title(content)
        # Should extract first line or use fallback
        assert len(title) > 0

    def test_extract_title_fallback(self, service: DocumentService) -> None:
        """Test title fallback for empty content."""
        title = service._extract_title("")
        assert title == "Untitled Document"


class TestDocumentToolInput:
    """Test DocumentToolInput validation."""

    def test_valid_input(self) -> None:
        """Test valid input creation."""
        input_data = DocumentToolInput(
            content="Write a letter to my landlord about urgent repairs needed",
            language="en",
            formality="formal",
            include_sa_context=True,
        )
        assert input_data.content.startswith("Write a letter")
        assert input_data.language == "en"

    def test_input_defaults(self) -> None:
        """Test input defaults."""
        input_data = DocumentToolInput(
            content="Write a letter to my landlord about urgent repairs needed",
        )
        assert input_data.language is None
        assert input_data.formality == "formal"
        assert input_data.include_sa_context is True

    def test_input_formality_validation(self) -> None:
        """Test formality validation."""
        for formality in ["formal", "semi-formal", "casual"]:
            input_data = DocumentToolInput(
                content="Write a letter to my landlord about urgent repairs needed",
                formality=formality,
            )
            assert input_data.formality == formality

    def test_content_min_length(self) -> None:
        """Test that content has minimum length."""
        with pytest.raises(ValueError):
            DocumentToolInput(content="Short")  # Too short


class TestLanguageMapping:
    """Test language code to name mapping."""

    def test_all_11_languages_mapped(self) -> None:
        """Test that all 11 SA languages have name mappings."""
        expected_codes = ["en", "af", "zu", "xh", "st", "tn", "ve", "ts", "nr", "ss", "nso"]
        for code in expected_codes:
            assert code in LANGUAGE_CODE_TO_NAME, f"Missing mapping for {code}"

    def test_english_mapping(self) -> None:
        """Test English mapping."""
        assert LANGUAGE_CODE_TO_NAME["en"] == "English"

    def test_zulu_mapping(self) -> None:
        """Test Zulu mapping."""
        assert LANGUAGE_CODE_TO_NAME["zu"] == "isiZulu"

    def test_afrikaans_mapping(self) -> None:
        """Test Afrikaans mapping."""
        assert LANGUAGE_CODE_TO_NAME["af"] == "Afrikaans"


class TestDocumentExecutor:
    """Test document executor integration."""

    @pytest.mark.asyncio
    async def test_execute_document_tool(self) -> None:
        """Test execute_document_tool function."""
        from app.tools.document_executor import execute_document_tool, _document_executor, get_document_executor
        
        # Reset the singleton
        import app.tools.document_executor as executor_module
        executor_module._document_executor = None

        with patch(
            "app.services.document_service.get_document_service"
        ) as mock_get_service:
            mock_service = mock_get_service.return_value
            mock_service.generate = AsyncMock(
                return_value=DocumentToolOutput(
                    title="Test Document",
                    content="# Document\n\nContent...",
                    domain="general",
                    document_type="general",
                    language="English",
                    word_count=5,
                    model_used="qwen-3-32b",
                    thinking_mode=True,
                    input_tokens=100,
                    output_tokens=200,
                    reasoning_tokens=0,
                    cost_usd=0.00005,
                    cost_zar=0.001,
                )
            )

            result = await execute_document_tool(
                arguments={
                    "content": "Write a letter to my landlord about repairs",
                    "language": "en",
                    "formality": "formal",
                    "include_sa_context": True,
                },
                user_tier="jive",
            )

            assert result["success"] is True
            assert result["display_type"] == "document"

    @pytest.mark.asyncio
    async def test_execute_with_missing_content(self) -> None:
        """Test handling of missing content parameter."""
        from app.tools.document_executor import execute_document_tool

        result = await execute_document_tool(
            arguments={},  # Missing content
            user_tier="jive",
        )

        assert result["success"] is False
        assert "error" in result


class TestEndToEndDocumentGeneration:
    """End-to-end tests for document generation flow."""

    @pytest.fixture
    def service(self) -> DocumentService:
        DocumentService._instance = None
        return DocumentService()

    def _mock_generation_result(
        self,
        content: str,
        model: str = "qwen-3-32b",
        provider: str = "cerebras",
        input_tokens: int = 200,
        output_tokens: int = 800,
    ) -> GenerationResult:
        """Create a mock GenerationResult for testing."""
        return GenerationResult(
            content=content,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            reasoning_tokens=0,
            model=model,
            provider=provider,
        )

    @pytest.mark.asyncio
    async def test_full_flow_legal_contract(self, service: DocumentService) -> None:
        """Test full flow for legal contract generation."""
        with patch.object(
            service, "_generate_document", new_callable=AsyncMock
        ) as mock_gen, patch.object(
            service, "_track_generation_cost", new_callable=AsyncMock
        ) as mock_cost:
            contract_content = """# Employment Contract

## Parties
This Employment Contract is entered into between:
- Employer: ABC Company (Pty) Ltd
- Employee: John Doe

## Terms and Conditions
1. Position and Duties
2. Remuneration
3. Leave Entitlement
4. Termination

## Compliance
This contract complies with the Labour Relations Act (LRA) and Basic Conditions of Employment Act (BCEA).

Signed on this day..."""

            mock_gen.return_value = self._mock_generation_result(
                contract_content,
                model="qwen-3-32b",
                provider="cerebras",
            )
            mock_cost.return_value = {"usd": 0.0003, "zar": 0.006}

            input_data = DocumentToolInput(
                content="Draft a comprehensive employment contract for a software developer position at ABC Company with salary R80,000 per month",
                document_type="contract",
                language="en",
                formality="formal",
                include_sa_context=True,
            )
            
            result = await service.generate(input_data, "jigga")

            assert isinstance(result, DocumentToolOutput)
            assert "Employment Contract" in result.content
            assert result.domain == "legal"

    @pytest.mark.asyncio
    async def test_full_flow_multilingual(self, service: DocumentService) -> None:
        """Test full flow for multilingual document."""
        with patch.object(
            service, "_generate_document", new_callable=AsyncMock
        ) as mock_gen, patch.object(
            service, "_track_generation_cost", new_callable=AsyncMock
        ) as mock_cost:
            zulu_content = """# Incwadi Yokukhala

Mnumzane/Nkosazana othandekayo,

Ngibhala le ncwadi ukuze ngikhalaze ngezinkinga zokulungiswa kwendlu yami...

Ozithobayo,
[Igama]"""

            mock_gen.return_value = self._mock_generation_result(
                zulu_content,
                model="qwen/qwen3-235b-a22b-instruct-2507",
                provider="openrouter",
            )
            mock_cost.return_value = {"usd": 0.0005, "zar": 0.01}

            input_data = DocumentToolInput(
                content="Bhala incwadi yokukhala ngokungalungiswi kwendlu ngesiZulu",
                language="zu",
                formality="formal",
                include_sa_context=True,
            )
            
            result = await service.generate(input_data, "jive")

            assert isinstance(result, DocumentToolOutput)
            assert result.language == "isiZulu"
