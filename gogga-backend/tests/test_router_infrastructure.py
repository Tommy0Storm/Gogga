"""
GOGGA Router Infrastructure Tests
==================================

Comprehensive test suite for the tier-based cognitive router.
Tests all routing paths, token constants, and tier behavior.

RUN: pytest tests/test_router_infrastructure.py -v
QUICK: pytest tests/test_router_infrastructure.py -v -k "not slow"

Created: December 2025 (Router Audit)
Updated: December 2025

Key Design Principles Tested:
- JIVE and JIGGA are MIRRORS for chat (only image/video/talk differ)
- 32B model: up to 8,000 output tokens
- 235B model: up to 40,000 output tokens (32k conservative limit)
- African languages route to 235B for better multilingual support
- Legal/complex keywords route to 235B for better reasoning
"""
import pytest
from typing import Final

from app.core.router import (
    # Main router
    tier_router,
    TierRouter,
    CognitiveLayer,
    UserTier,
    
    # Token constants (new naming)
    QWEN_32B_MAX_TOKENS,
    QWEN_32B_DEFAULT_TOKENS,
    QWEN_235B_MAX_TOKENS,
    QWEN_235B_DEFAULT_TOKENS,
    
    # Legacy aliases (should still work)
    QWEN_MAX_TOKENS,
    QWEN_DEFAULT_TOKENS,
    JIGGA_235B_MAX_TOKENS,
    JIGGA_MAX_TOKENS,
    JIGGA_DEFAULT_TOKENS,
    
    # Settings
    QWEN_THINKING_SETTINGS,
    IMAGE_LIMITS,
    
    # Keyword sets
    COMPLEX_235B_KEYWORDS,
    EXTENDED_OUTPUT_KEYWORDS,
    COMPLEX_OUTPUT_KEYWORDS,
    IMAGE_KEYWORDS,
    SA_BANTU_LANGUAGE_PATTERNS,
    
    # Detection functions
    is_image_prompt,
    is_extended_output_request,
    is_complex_output_request,
    is_document_analysis_request,
    contains_african_language,
)


# =============================================================================
# TOKEN CONSTANT TESTS
# =============================================================================

class TestTokenConstants:
    """Verify token constants have correct values."""
    
    def test_qwen_32b_max_tokens(self):
        """32B model max tokens should be 8000."""
        assert QWEN_32B_MAX_TOKENS == 8000
    
    def test_qwen_32b_default_tokens(self):
        """32B default should be less than max for casual chat."""
        assert QWEN_32B_DEFAULT_TOKENS == 4096
        assert QWEN_32B_DEFAULT_TOKENS < QWEN_32B_MAX_TOKENS
    
    def test_qwen_235b_max_tokens(self):
        """235B model max tokens should be 32000 (conservative, max is 40k)."""
        assert QWEN_235B_MAX_TOKENS == 32000
    
    def test_qwen_235b_default_tokens(self):
        """235B default should be reasonable for complex queries."""
        assert QWEN_235B_DEFAULT_TOKENS == 8000
        assert QWEN_235B_DEFAULT_TOKENS < QWEN_235B_MAX_TOKENS
    
    def test_235b_larger_than_32b(self):
        """235B should have larger token limits than 32B."""
        assert QWEN_235B_MAX_TOKENS > QWEN_32B_MAX_TOKENS
        assert QWEN_235B_DEFAULT_TOKENS >= QWEN_32B_DEFAULT_TOKENS


class TestLegacyAliases:
    """Verify legacy constant aliases still work for backwards compatibility."""
    
    def test_qwen_max_tokens_alias(self):
        """QWEN_MAX_TOKENS should alias to QWEN_32B_MAX_TOKENS."""
        assert QWEN_MAX_TOKENS == QWEN_32B_MAX_TOKENS
    
    def test_qwen_default_tokens_alias(self):
        """QWEN_DEFAULT_TOKENS should alias to QWEN_32B_DEFAULT_TOKENS."""
        assert QWEN_DEFAULT_TOKENS == QWEN_32B_DEFAULT_TOKENS
    
    def test_jigga_235b_max_tokens_alias(self):
        """JIGGA_235B_MAX_TOKENS should alias to QWEN_235B_MAX_TOKENS."""
        assert JIGGA_235B_MAX_TOKENS == QWEN_235B_MAX_TOKENS
    
    def test_jigga_max_tokens_alias(self):
        """JIGGA_MAX_TOKENS should alias to QWEN_32B_MAX_TOKENS."""
        assert JIGGA_MAX_TOKENS == QWEN_32B_MAX_TOKENS
    
    def test_jigga_default_tokens_alias(self):
        """JIGGA_DEFAULT_TOKENS should alias to QWEN_32B_DEFAULT_TOKENS."""
        assert JIGGA_DEFAULT_TOKENS == QWEN_32B_DEFAULT_TOKENS


# =============================================================================
# TIER ROUTING TESTS
# =============================================================================

class TestFreeTierRouting:
    """FREE tier always uses OpenRouter Qwen 235B FREE."""
    
    def test_free_simple_query(self):
        """Simple queries route to FREE_TEXT."""
        layer = tier_router.classify_intent("Hello there", UserTier.FREE)
        assert layer == CognitiveLayer.FREE_TEXT
    
    def test_free_complex_query_still_free_text(self):
        """Even complex queries use FREE_TEXT on FREE tier."""
        layer = tier_router.classify_intent("Explain constitutional law", UserTier.FREE)
        assert layer == CognitiveLayer.FREE_TEXT
    
    def test_free_african_language_still_free_text(self):
        """African languages use FREE_TEXT on FREE tier."""
        layer = tier_router.classify_intent("Sawubona, ngicela usizo", UserTier.FREE)
        assert layer == CognitiveLayer.FREE_TEXT
    
    def test_free_image_prompt_routes_to_image(self):
        """Image prompts on FREE tier route to FREE_IMAGE."""
        layer = tier_router.classify_intent("Draw me a picture of a cat", UserTier.FREE)
        assert layer == CognitiveLayer.FREE_IMAGE


class TestJiveTierRouting:
    """JIVE tier uses Cerebras Qwen 32B (general) or 235B (complex)."""
    
    def test_jive_simple_query_uses_32b(self):
        """Simple queries use JIVE_TEXT (32B)."""
        queries = [
            "What is Python?",
            "Hello there!",
            "Tell me a joke",
            "How do I make pasta?",
        ]
        for query in queries:
            layer = tier_router.classify_intent(query, UserTier.JIVE)
            assert layer == CognitiveLayer.JIVE_TEXT, f"Failed for: {query}"
    
    def test_jive_complex_legal_uses_235b(self):
        """Legal/complex queries use JIVE_COMPLEX (235B)."""
        queries = [
            "Explain the constitutional implications",
            "What are the litigation options?",
            "POPIA compliance requirements",
        ]
        for query in queries:
            layer = tier_router.classify_intent(query, UserTier.JIVE)
            assert layer == CognitiveLayer.JIVE_COMPLEX, f"Failed for: {query}"
    
    def test_jive_african_language_uses_235b(self):
        """African languages use JIVE_COMPLEX (235B) for multilingual."""
        queries = [
            "Sawubona, unjani?",  # Zulu
            "Molo, unjani?",      # Xhosa
            "Dumela, o kae?",     # Tswana
        ]
        for query in queries:
            layer = tier_router.classify_intent(query, UserTier.JIVE)
            assert layer == CognitiveLayer.JIVE_COMPLEX, f"Failed for: {query}"
    
    def test_jive_comprehensive_analysis_uses_235b(self):
        """Comprehensive analysis routes to 235B."""
        layer = tier_router.classify_intent(
            "Write me a comprehensive analysis of this data", 
            UserTier.JIVE
        )
        assert layer == CognitiveLayer.JIVE_COMPLEX


class TestJiggaTierRouting:
    """JIGGA tier uses Cerebras Qwen 32B (general) or 235B (complex)."""
    
    def test_jigga_simple_query_uses_32b(self):
        """Simple queries use JIGGA_THINK (32B with thinking)."""
        queries = [
            "What is Python?",
            "Hello there!",
            "Tell me a joke",
        ]
        for query in queries:
            layer = tier_router.classify_intent(query, UserTier.JIGGA)
            assert layer == CognitiveLayer.JIGGA_THINK, f"Failed for: {query}"
    
    def test_jigga_complex_legal_uses_235b(self):
        """Legal/complex queries use JIGGA_COMPLEX (235B)."""
        queries = [
            "What does POPIA say about data retention?",
            "Constitutional analysis of this law",
            "Perform a security audit",
        ]
        for query in queries:
            layer = tier_router.classify_intent(query, UserTier.JIGGA)
            assert layer == CognitiveLayer.JIGGA_COMPLEX, f"Failed for: {query}"
    
    def test_jigga_african_language_uses_235b(self):
        """African languages use JIGGA_COMPLEX (235B) for multilingual."""
        queries = [
            "Sawubona",           # Zulu greeting
            "Ngiyabonga kakhulu", # Zulu thank you
            "Enkosi kakhulu",     # Xhosa thank you
        ]
        for query in queries:
            layer = tier_router.classify_intent(query, UserTier.JIGGA)
            assert layer == CognitiveLayer.JIGGA_COMPLEX, f"Failed for: {query}"


class TestJiveJiggaMirror:
    """
    JIVE and JIGGA should behave identically for chat.
    Only image/video/talk limits differ.
    """
    
    def test_simple_query_same_behavior(self):
        """Simple queries should route to equivalent layers."""
        query = "What is machine learning?"
        jive_layer = tier_router.classify_intent(query, UserTier.JIVE)
        jigga_layer = tier_router.classify_intent(query, UserTier.JIGGA)
        
        # Both should use 32B (JIVE_TEXT / JIGGA_THINK)
        assert jive_layer == CognitiveLayer.JIVE_TEXT
        assert jigga_layer == CognitiveLayer.JIGGA_THINK
    
    def test_complex_query_same_behavior(self):
        """Complex queries should route to equivalent layers."""
        query = "Analyze the constitutional implications"
        jive_layer = tier_router.classify_intent(query, UserTier.JIVE)
        jigga_layer = tier_router.classify_intent(query, UserTier.JIGGA)
        
        # Both should use 235B (JIVE_COMPLEX / JIGGA_COMPLEX)
        assert jive_layer == CognitiveLayer.JIVE_COMPLEX
        assert jigga_layer == CognitiveLayer.JIGGA_COMPLEX
    
    def test_african_language_same_behavior(self):
        """African languages should route to equivalent layers."""
        query = "Sawubona, ngicela usizo"
        jive_layer = tier_router.classify_intent(query, UserTier.JIVE)
        jigga_layer = tier_router.classify_intent(query, UserTier.JIGGA)
        
        # Both should use 235B
        assert jive_layer == CognitiveLayer.JIVE_COMPLEX
        assert jigga_layer == CognitiveLayer.JIGGA_COMPLEX
    
    def test_image_limits_differ(self):
        """Image limits should differ between JIVE and JIGGA."""
        assert IMAGE_LIMITS[UserTier.JIVE] == 200
        assert IMAGE_LIMITS[UserTier.JIGGA] == 1000
        assert IMAGE_LIMITS[UserTier.JIGGA] > IMAGE_LIMITS[UserTier.JIVE]


# =============================================================================
# SYSTEM PROMPT TESTS
# =============================================================================

class TestSystemPrompts:
    """All cognitive layers should have valid system prompts."""
    
    @pytest.mark.parametrize("layer", [
        CognitiveLayer.FREE_TEXT,
        CognitiveLayer.JIVE_TEXT,
        CognitiveLayer.JIVE_COMPLEX,  # This was missing before the audit fix!
        CognitiveLayer.JIGGA_THINK,
        CognitiveLayer.JIGGA_COMPLEX,
        CognitiveLayer.ENHANCE_PROMPT,
    ])
    def test_layer_has_prompt(self, layer: CognitiveLayer):
        """Each layer should return a non-empty prompt."""
        prompt = tier_router.get_system_prompt(layer)
        assert isinstance(prompt, str)
        assert len(prompt) > 100, f"Prompt for {layer} seems too short"
    
    def test_jive_complex_has_prompt(self):
        """JIVE_COMPLEX should have a proper prompt (audit fix verification)."""
        prompt = tier_router.get_system_prompt(CognitiveLayer.JIVE_COMPLEX)
        assert len(prompt) > 1000  # Should be a substantial prompt
        # Should NOT fall back to free_text (which would be shorter)
    
    def test_paid_tier_prompts_are_substantial(self):
        """Paid tier prompts should be substantial (all share core GOGGA personality)."""
        free_prompt = tier_router.get_system_prompt(CognitiveLayer.FREE_TEXT)
        jive_prompt = tier_router.get_system_prompt(CognitiveLayer.JIVE_TEXT)
        jigga_prompt = tier_router.get_system_prompt(CognitiveLayer.JIGGA_THINK)
        
        # All prompts should be substantial (share core GOGGA personality)
        # Note: FREE and paid tiers may have similar lengths since they share
        # the same base personality - only mode differences
        assert len(free_prompt) >= 5000, "FREE prompt too short"
        assert len(jive_prompt) >= 5000, "JIVE prompt too short"
        assert len(jigga_prompt) >= 5000, "JIGGA prompt too short"


# =============================================================================
# MODEL CONFIG TESTS
# =============================================================================

class TestModelConfig:
    """Model configurations should be valid."""
    
    @pytest.mark.parametrize("layer", [
        CognitiveLayer.FREE_TEXT,
        CognitiveLayer.JIVE_TEXT,
        CognitiveLayer.JIVE_COMPLEX,
        CognitiveLayer.JIGGA_THINK,
        CognitiveLayer.JIGGA_COMPLEX,
    ])
    def test_layer_has_config(self, layer: CognitiveLayer):
        """Each layer should have a valid config dict."""
        config = tier_router.get_model_config(layer)
        assert isinstance(config, dict)
        assert "model" in config
        assert "provider" in config
        assert "settings" in config
    
    def test_free_uses_openrouter(self):
        """FREE tier should use OpenRouter."""
        config = tier_router.get_model_config(CognitiveLayer.FREE_TEXT)
        assert config["provider"] == "openrouter"
    
    def test_paid_tiers_use_cerebras(self):
        """Paid tiers should use Cerebras."""
        for layer in [CognitiveLayer.JIVE_TEXT, CognitiveLayer.JIGGA_THINK]:
            config = tier_router.get_model_config(layer)
            assert config["provider"] == "cerebras"
    
    def test_complex_layers_have_max_tokens(self):
        """Complex layers should specify max_tokens."""
        for layer in [CognitiveLayer.JIVE_COMPLEX, CognitiveLayer.JIGGA_COMPLEX]:
            config = tier_router.get_model_config(layer)
            assert "max_tokens" in config
            assert config["max_tokens"] == QWEN_235B_MAX_TOKENS


# =============================================================================
# KEYWORD DETECTION TESTS
# =============================================================================

class TestKeywordDetection:
    """Test keyword detection functions."""
    
    def test_image_prompt_detection(self):
        """is_image_prompt should detect image generation requests."""
        positives = [
            "Draw me a cat",
            "Create an image of mountains",
            "Generate a picture of a sunset",
        ]
        negatives = [
            "What is a cat?",
            "I saw a picture yesterday",
            "The image quality was poor",
        ]
        
        for prompt in positives:
            assert is_image_prompt(prompt), f"Should detect: {prompt}"
        
        for prompt in negatives:
            assert not is_image_prompt(prompt), f"Should NOT detect: {prompt}"
    
    def test_extended_output_detection(self):
        """is_extended_output_request should detect long-form requests."""
        positives = [
            "Write a report on climate change",
            "Give me a full explanation",
            "I need a very detailed answer",
        ]
        
        for prompt in positives:
            assert is_extended_output_request(prompt), f"Should detect: {prompt}"
    
    def test_complex_output_detection(self):
        """is_complex_output_request should detect 235B-worthy requests."""
        positives = [
            "Write a comprehensive analysis",
            "Provide a detailed review",
            "Create a full report with recommendations",
        ]
        
        for prompt in positives:
            assert is_complex_output_request(prompt), f"Should detect: {prompt}"
    
    def test_african_language_detection(self):
        """contains_african_language should detect SA Bantu languages."""
        positives = [
            "Sawubona",        # Zulu
            "Molo",            # Xhosa  
            "Dumela",          # Tswana
            "Ngiyabonga",      # Zulu thank you
            "Ubuntu",          # Widely known
        ]
        
        for text in positives:
            assert contains_african_language(text), f"Should detect: {text}"
        
        # Should NOT trigger on English
        assert not contains_african_language("Hello, how are you?")


# =============================================================================
# THINKING SETTINGS TESTS
# =============================================================================

class TestThinkingSettings:
    """Verify Qwen thinking mode settings."""
    
    def test_temperature_not_zero(self):
        """Temperature must NOT be 0 (causes infinite loops)."""
        assert QWEN_THINKING_SETTINGS["temperature"] > 0
        assert QWEN_THINKING_SETTINGS["temperature"] >= 0.6
    
    def test_top_p_reasonable(self):
        """top_p should be reasonable for thinking mode."""
        assert 0.8 <= QWEN_THINKING_SETTINGS["top_p"] <= 1.0
    
    def test_top_k_set(self):
        """top_k should be set for quality."""
        assert "top_k" in QWEN_THINKING_SETTINGS
        assert QWEN_THINKING_SETTINGS["top_k"] > 0


# =============================================================================
# EDGE CASE TESTS
# =============================================================================

class TestEdgeCases:
    """Test edge cases and boundary conditions."""
    
    def test_empty_message(self):
        """Empty message should not crash."""
        layer = tier_router.classify_intent("", UserTier.FREE)
        assert layer == CognitiveLayer.FREE_TEXT
    
    def test_very_long_message(self):
        """Very long message should not crash."""
        long_msg = "Hello " * 10000
        layer = tier_router.classify_intent(long_msg, UserTier.JIGGA)
        # Should still work (defaults to JIGGA_THINK)
        assert layer in (CognitiveLayer.JIGGA_THINK, CognitiveLayer.JIGGA_COMPLEX)
    
    def test_unicode_characters(self):
        """Unicode should not crash."""
        layer = tier_router.classify_intent("Hello 🚀 世界 مرحبا", UserTier.JIVE)
        assert layer in (CognitiveLayer.JIVE_TEXT, CognitiveLayer.JIVE_COMPLEX)
    
    def test_case_insensitivity(self):
        """Keywords should match case-insensitively."""
        # "POPIA" should trigger 235B just like "popia"
        layer1 = tier_router.classify_intent("What is POPIA?", UserTier.JIGGA)
        layer2 = tier_router.classify_intent("What is popia?", UserTier.JIGGA)
        assert layer1 == layer2 == CognitiveLayer.JIGGA_COMPLEX


# =============================================================================
# INTEGRATION TESTS (marked slow)
# =============================================================================

@pytest.mark.slow
class TestRouterIntegration:
    """Integration tests that verify the full routing pipeline."""
    
    def test_full_routing_flow(self):
        """Test complete routing flow for all tiers."""
        test_cases = [
            # (message, tier, expected_layer)
            ("Hello", UserTier.FREE, CognitiveLayer.FREE_TEXT),
            ("Hello", UserTier.JIVE, CognitiveLayer.JIVE_TEXT),
            ("Hello", UserTier.JIGGA, CognitiveLayer.JIGGA_THINK),
            ("Constitutional law", UserTier.JIVE, CognitiveLayer.JIVE_COMPLEX),
            ("Sawubona", UserTier.JIGGA, CognitiveLayer.JIGGA_COMPLEX),
        ]
        
        for msg, tier, expected in test_cases:
            layer = tier_router.classify_intent(msg, tier)
            assert layer == expected, f"Failed: {msg} @ {tier} -> {layer} (expected {expected})"
    
    def test_ai_service_imports_work(self):
        """Verify ai_service can import router correctly."""
        from app.services.ai_service import AIService
        assert AIService is not None


# =============================================================================
# KEYWORD SET INTEGRITY TESTS
# =============================================================================

class TestKeywordSets:
    """Verify keyword sets are properly defined."""
    
    def test_complex_keywords_lowercase(self):
        """All complex keywords should be lowercase."""
        for kw in COMPLEX_235B_KEYWORDS:
            assert kw == kw.lower(), f"Keyword not lowercase: {kw}"
    
    def test_extended_keywords_lowercase(self):
        """All extended keywords should be lowercase."""
        for kw in EXTENDED_OUTPUT_KEYWORDS:
            assert kw == kw.lower(), f"Keyword not lowercase: {kw}"
    
    def test_complex_keywords_no_duplicates(self):
        """No duplicate keywords in complex set."""
        assert len(COMPLEX_235B_KEYWORDS) == len(set(COMPLEX_235B_KEYWORDS))
    
    def test_essential_legal_keywords_present(self):
        """Essential legal keywords should be present."""
        essential = ["constitutional", "litigation", "popia", "compliance"]
        for kw in essential:
            assert kw in COMPLEX_235B_KEYWORDS, f"Missing: {kw}"
    
    def test_essential_african_patterns_present(self):
        """Essential African language patterns should be present."""
        essential = ["sawubona", "molo", "dumela", "ubuntu"]
        for pattern in essential:
            assert pattern in SA_BANTU_LANGUAGE_PATTERNS, f"Missing: {pattern}"


# =============================================================================
# QUICK VERIFICATION (run with: pytest -k "quick")
# =============================================================================

class TestQuickVerification:
    """Quick sanity checks that should always pass."""
    
    @pytest.mark.quick
    def test_router_singleton_exists(self):
        """tier_router singleton should exist."""
        assert tier_router is not None
        assert isinstance(tier_router, TierRouter)
    
    @pytest.mark.quick
    def test_all_tiers_defined(self):
        """All user tiers should be defined."""
        assert UserTier.FREE is not None
        assert UserTier.JIVE is not None
        assert UserTier.JIGGA is not None
    
    @pytest.mark.quick
    def test_all_layers_defined(self):
        """All cognitive layers should be defined."""
        assert CognitiveLayer.FREE_TEXT is not None
        assert CognitiveLayer.JIVE_TEXT is not None
        assert CognitiveLayer.JIVE_COMPLEX is not None
        assert CognitiveLayer.JIGGA_THINK is not None
        assert CognitiveLayer.JIGGA_COMPLEX is not None
    
    @pytest.mark.quick
    def test_token_constants_positive(self):
        """All token constants should be positive."""
        assert QWEN_32B_MAX_TOKENS > 0
        assert QWEN_32B_DEFAULT_TOKENS > 0
        assert QWEN_235B_MAX_TOKENS > 0
        assert QWEN_235B_DEFAULT_TOKENS > 0
