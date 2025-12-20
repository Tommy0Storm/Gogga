"""
Tests for the Tier Routing Logic

UPDATED (2025-01): Simplified architecture
- JIVE: Qwen 32B (no more CePO)
- JIGGA: Qwen 32B (general) + 235B (complex/legal)
"""
import pytest
from app.core.router import (
    tier_router, 
    TierRouter,
    COMPLEX_235B_KEYWORDS, 
    CognitiveLayer, 
    UserTier
)


class TestTierRouter:
    """Test suite for the Tier Router."""
    
    def test_free_tier_uses_free_text(self):
        """FREE tier should always use FREE_TEXT layer for text."""
        messages = [
            "Hi there!",
            "Howzit?",
            "Hello",
            "Good morning",
            "Thanks",
            "What is the weather?",
            "Explain POPIA to me",  # Even complex topics use FREE_TEXT on FREE tier
        ]
        
        for msg in messages:
            layer = tier_router.classify_intent(msg, UserTier.FREE)
            assert layer == CognitiveLayer.FREE_TEXT, f"Expected FREE_TEXT for '{msg}', got '{layer}'"
    
    def test_free_tier_image_prompt(self):
        """FREE tier image prompts should use FREE_IMAGE layer."""
        messages = [
            "Generate an image of a cat",
            "Create a picture of the Table Mountain",
            "Draw me a portrait",
        ]
        
        for msg in messages:
            layer = tier_router.classify_intent(msg, UserTier.FREE)
            assert layer == CognitiveLayer.FREE_IMAGE, f"Expected FREE_IMAGE for '{msg}', got '{layer}'"
    
    def test_jive_uses_jive_text(self):
        """JIVE tier should use JIVE_TEXT for general queries (not legal/complex)."""
        messages = [
            "Write a Python function to parse JSON",
            "Hi there!",
            "What's the weather?",
            "Tell me a joke",
        ]
        
        for msg in messages:
            layer = tier_router.classify_intent(msg, UserTier.JIVE)
            assert layer == CognitiveLayer.JIVE_TEXT, f"Expected JIVE_TEXT for '{msg}', got '{layer}'"
    
    def test_jive_complex_routes_to_235b(self):
        """JIVE tier should route legal/complex queries to JIVE_COMPLEX (235B)."""
        messages = [
            "What does POPIA say about data retention?",
            "Is this constitutional?",
            "What are the litigation options here?",
        ]
        
        for msg in messages:
            layer = tier_router.classify_intent(msg, UserTier.JIVE)
            assert layer == CognitiveLayer.JIVE_COMPLEX, f"Expected JIVE_COMPLEX for '{msg}', got '{layer}'"
    
    def test_jigga_default_uses_thinking(self):
        """JIGGA tier should default to JIGGA_THINK for general queries."""
        messages = [
            "Hi there!",
            "What is quantum computing?",
            "Explain machine learning",
        ]
        
        for msg in messages:
            layer = tier_router.classify_intent(msg, UserTier.JIGGA)
            assert layer == CognitiveLayer.JIGGA_THINK, f"Expected JIGGA_THINK for '{msg}', got '{layer}'"
    
    def test_jigga_complex_uses_235b(self):
        """JIGGA tier complex/legal queries should use JIGGA_COMPLEX (235B)."""
        messages = [
            "Analyze the constitutional implications deeply",  # legal + deep analysis
            "What are the POPIA compliance requirements?",  # legal
            "Perform a security audit on this system",  # complex coding
        ]
        
        for msg in messages:
            layer = tier_router.classify_intent(msg, UserTier.JIGGA)
            assert layer == CognitiveLayer.JIGGA_COMPLEX, f"Expected JIGGA_COMPLEX for '{msg}', got '{layer}'"
    
    def test_jigga_african_language_uses_complex(self):
        """JIGGA tier African language content should use JIGGA_COMPLEX (235B)."""
        messages = [
            "Sawubona, unjani?",  # isiZulu greeting
            "Molo, unjani?",  # isiXhosa greeting
            "Dumela, o kae?",  # Setswana greeting
        ]
        
        for msg in messages:
            layer = tier_router.classify_intent(msg, UserTier.JIGGA)
            assert layer == CognitiveLayer.JIGGA_COMPLEX, f"Expected JIGGA_COMPLEX for '{msg}', got '{layer}'"
    
    def test_get_model_config_returns_dict(self):
        """get_model_config should return a dictionary with required keys."""
        for layer in CognitiveLayer:
            # Skip layers that might not have full config
            if layer in (CognitiveLayer.MULTIMODAL,):
                continue
            config = tier_router.get_model_config(layer)
            assert isinstance(config, dict), f"Config for {layer} should be a dict"
            assert "model" in config, f"Config for {layer} should have model"
            assert "provider" in config, f"Config for {layer} should have provider"
    
    def test_get_system_prompt_returns_string(self):
        """get_system_prompt should return a non-empty string for supported layers."""
        supported_layers = [
            CognitiveLayer.FREE_TEXT,
            CognitiveLayer.JIVE_TEXT,
            CognitiveLayer.JIGGA_THINK,
            CognitiveLayer.JIGGA_COMPLEX,
            CognitiveLayer.ENHANCE_PROMPT,
        ]
        for layer in supported_layers:
            prompt = tier_router.get_system_prompt(layer)
            assert isinstance(prompt, str), f"Prompt for {layer} should be a string"
            assert len(prompt) > 0, f"Prompt for {layer} should not be empty"


class TestComplex235BKeywords:
    """Test the complex 235B keywords list."""
    
    def test_keywords_are_lowercase(self):
        """All keywords should be lowercase for matching."""
        for keyword in COMPLEX_235B_KEYWORDS:
            assert keyword == keyword.lower(), f"Keyword '{keyword}' should be lowercase"
    
    def test_essential_keywords_present(self):
        """Essential keywords should be in the list."""
        essential = ["popia", "constitutional", "security audit", "legal implications"]
        
        for keyword in essential:
            assert keyword in COMPLEX_235B_KEYWORDS, f"Essential keyword '{keyword}' missing"


# Legacy aliases for backward compatibility
TestBicameralRouter = TestTierRouter
bicameral_router = tier_router