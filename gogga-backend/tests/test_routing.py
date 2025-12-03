"""
Tests for the Bicameral Routing Logic
"""
import pytest
from app.core.router import bicameral_router, COMPLEX_KEYWORDS


class TestBicameralRouter:
    """Test suite for the Bicameral Router."""
    
    def test_simple_greeting_uses_speed_layer(self):
        """Simple greetings should use the Speed Layer."""
        messages = [
            "Hi there!",
            "Howzit?",
            "Hello",
            "Good morning",
            "Thanks"
        ]
        
        for msg in messages:
            layer = bicameral_router.classify_intent(msg)
            assert layer == "speed", f"Expected 'speed' for '{msg}', got '{layer}'"
    
    def test_legal_query_uses_complex_layer(self):
        """Legal queries should trigger the Complex Layer."""
        messages = [
            "What does POPIA say about data retention?",
            "Explain the Constitution Chapter 2",
            "Is this contract clause legal?",
            "What are my rights under consumer protection act?"
        ]
        
        for msg in messages:
            layer = bicameral_router.classify_intent(msg)
            assert layer == "complex", f"Expected 'complex' for '{msg}', got '{layer}'"
    
    def test_coding_query_uses_complex_layer(self):
        """Coding queries should trigger the Complex Layer."""
        messages = [
            "Write a Python function to parse JSON",
            "Debug this algorithm",
            "How do I deploy to Docker?",
            "Explain this API endpoint"
        ]
        
        for msg in messages:
            layer = bicameral_router.classify_intent(msg)
            assert layer == "complex", f"Expected 'complex' for '{msg}', got '{layer}'"
    
    def test_translation_uses_complex_layer(self):
        """Translation requests should use Complex Layer."""
        messages = [
            "Translate this to isiZulu",
            "How do you say hello in Xhosa?",
            "Translate to Afrikaans please"
        ]
        
        for msg in messages:
            layer = bicameral_router.classify_intent(msg)
            assert layer == "complex", f"Expected 'complex' for '{msg}', got '{layer}'"
    
    def test_long_message_uses_complex_layer(self):
        """Messages with more than 50 words should use Complex Layer."""
        long_message = " ".join(["word"] * 60)  # 60 words
        
        layer = bicameral_router.classify_intent(long_message)
        assert layer == "complex", "Long messages should use complex layer"
    
    def test_short_message_uses_speed_layer(self):
        """Short simple messages should use Speed Layer."""
        short_message = "What is the weather?"
        
        layer = bicameral_router.classify_intent(short_message)
        assert layer == "speed", "Short simple messages should use speed layer"
    
    def test_get_model_id_speed(self):
        """Test model ID retrieval for speed layer."""
        model_id = bicameral_router.get_model_id("speed")
        assert "llama" in model_id.lower() or "8b" in model_id.lower()
    
    def test_get_model_id_complex(self):
        """Test model ID retrieval for complex layer."""
        model_id = bicameral_router.get_model_id("complex")
        assert "qwen" in model_id.lower() or "235b" in model_id.lower()
    
    def test_system_prompt_speed_is_concise(self):
        """Speed layer prompt should be concise."""
        prompt = bicameral_router.get_system_prompt("speed")
        assert "Complex Mode" not in prompt
        assert "South African" in prompt
    
    def test_system_prompt_complex_includes_legal_context(self):
        """Complex layer prompt should include legal context."""
        prompt = bicameral_router.get_system_prompt("complex")
        assert "Complex Mode" in prompt
        assert "South African" in prompt
        assert "legal" in prompt.lower() or "Law" in prompt


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
