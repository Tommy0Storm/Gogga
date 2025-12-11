"""
Tests for the Tier Routing Logic

Updated to use TierRouter API with CognitiveLayer enum.
"""
import pytest
from app.core.router import (
    tier_router, 
    TierRouter,
    COMPLEX_KEYWORDS, 
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
    
    def test_jive_complex_keywords_use_reasoning(self):
        """JIVE tier complex queries should use JIVE_REASONING (CePO)."""
        messages = [
            "What does POPIA say about data retention?",
            "Explain the Constitution Chapter 2",
            "Write a Python function to parse JSON",
            "Debug this algorithm",
        ]
        
        for msg in messages:
            layer = tier_router.classify_intent(msg, UserTier.JIVE)
            assert layer == CognitiveLayer.JIVE_REASONING, f"Expected JIVE_REASONING for '{msg}', got '{layer}'"
    
    def test_jive_simple_queries_use_speed(self):
        """JIVE tier simple queries should use JIVE_SPEED."""
        messages = [
            "Hi there!",
            "What's the weather?",
            "Tell me a joke",
        ]
        
        for msg in messages:
            layer = tier_router.classify_intent(msg, UserTier.JIVE)
            assert layer == CognitiveLayer.JIVE_SPEED, f"Expected JIVE_SPEED for '{msg}', got '{layer}'"
    
    def test_jigga_default_uses_thinking(self):
        """JIGGA tier should default to JIGGA_THINK."""
        messages = [
            "Hi there!",
            "What is quantum computing?",
            "Explain machine learning",
        ]
        
        for msg in messages:
            layer = tier_router.classify_intent(msg, UserTier.JIGGA)
            assert layer == CognitiveLayer.JIGGA_THINK, f"Expected JIGGA_THINK for '{msg}', got '{layer}'"
    
    def test_jigga_african_language_uses_multilingual(self):
        """JIGGA tier African language content should use JIGGA_MULTILINGUAL."""
        messages = [
            "Sawubona, unjani?",  # isiZulu greeting
            "Molo, unjani?",  # isiXhosa greeting
            "Dumela, o kae?",  # Setswana greeting
        ]
        
        for msg in messages:
            layer = tier_router.classify_intent(msg, UserTier.JIGGA)
            assert layer == CognitiveLayer.JIGGA_MULTILINGUAL, f"Expected JIGGA_MULTILINGUAL for '{msg}', got '{layer}'"
    
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
        """get_system_prompt should return a non-empty string."""
        for tier in UserTier:
            prompt = tier_router.get_system_prompt(tier)
            assert isinstance(prompt, str), f"Prompt for {tier} should be a string"
            assert len(prompt) > 0, f"Prompt for {tier} should not be empty"
            assert "South African" in prompt or "GOGGA" in prompt, f"Prompt should mention SA identity"


class TestComplexKeywords:
    """Test the complex keywords list."""
    
    def test_keywords_are_lowercase(self):
        """All keywords should be lowercase for matching."""
        for keyword in COMPLEX_KEYWORDS:
            assert keyword == keyword.lower(), f"Keyword '{keyword}' should be lowercase"
    
    def test_essential_keywords_present(self):
        """Essential keywords should be in the list."""
        essential = ["popia", "constitution", "code", "translate", "python"]
        
        for keyword in essential:
            assert keyword in COMPLEX_KEYWORDS, f"Essential keyword '{keyword}' missing"


# Legacy aliases for backward compatibility
TestBicameralRouter = TestTierRouter
bicameral_router = tier_router
