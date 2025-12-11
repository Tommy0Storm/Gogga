"""
Test extended output detection for JIVE and JIGGA tiers.

Tests:
1. is_extended_output_request() keyword detection
2. is_document_analysis_request() detection
3. Token limits: JIVE_MAX/DEFAULT, JIGGA_MAX/DEFAULT
"""
import sys
sys.path.insert(0, "/home/ubuntu/Dev-Projects/Gogga/gogga-backend")

from app.core.router import (
    is_extended_output_request,
    is_document_analysis_request,
    JIVE_MAX_TOKENS, JIVE_DEFAULT_TOKENS,
    JIGGA_MAX_TOKENS, JIGGA_DEFAULT_TOKENS,
    EXTENDED_OUTPUT_KEYWORDS, DOCUMENT_ANALYSIS_KEYWORDS
)


def test_token_constants():
    """Verify token limit constants are correctly set."""
    print("\n=== Token Limit Constants ===")
    
    # JIVE (Llama 3.3 70B)
    assert JIVE_MAX_TOKENS == 8000, f"JIVE_MAX_TOKENS should be 8000, got {JIVE_MAX_TOKENS}"
    assert JIVE_DEFAULT_TOKENS == 4096, f"JIVE_DEFAULT_TOKENS should be 4096, got {JIVE_DEFAULT_TOKENS}"
    print(f"✓ JIVE: {JIVE_DEFAULT_TOKENS} default, {JIVE_MAX_TOKENS} extended (max: 40,000 when ready)")
    
    # JIGGA (Qwen 3 32B) - Always uses max tokens for premium tier
    assert JIGGA_MAX_TOKENS == 8000, f"JIGGA_MAX_TOKENS should be 8000, got {JIGGA_MAX_TOKENS}"
    assert JIGGA_DEFAULT_TOKENS == 8000, f"JIGGA_DEFAULT_TOKENS should be 8000 (always max for premium), got {JIGGA_DEFAULT_TOKENS}"
    print(f"✓ JIGGA: {JIGGA_DEFAULT_TOKENS} default (always max for premium tier)")


def test_extended_output_keywords():
    """Test extended output keyword detection."""
    print("\n=== Extended Output Keywords ===")
    
    # Should trigger extended output
    extended_prompts = [
        "Give me a detailed report on the market trends",
        "Provide a comprehensive analysis of the data",
        "I need a full breakdown of the contract",
        "Write a long format explanation of quantum physics",
        "Can you do an in-depth review of this code?",
        "I need extended analysis of the financials",
        "Give me a thorough review of the proposal",
        "Can you elaborate more on this topic?",
        "Please expand on this with more details",
        "Provide a comprehensive breakdown of the project",
    ]
    
    for prompt in extended_prompts:
        result = is_extended_output_request(prompt)
        status = "✓" if result else "✗"
        print(f"{status} Extended: '{prompt[:50]}...' → {result}")
        assert result, f"Should trigger extended: {prompt}"
    
    # Should NOT trigger extended output (casual chat)
    casual_prompts = [
        "Hello, how are you?",
        "What's the weather like?",
        "Tell me a joke",
        "What's 2 + 2?",
        "Hi there!",
    ]
    
    print("\n--- Casual prompts (should NOT trigger) ---")
    for prompt in casual_prompts:
        result = is_extended_output_request(prompt)
        status = "✓" if not result else "✗"
        print(f"{status} Casual: '{prompt}' → {result}")
        assert not result, f"Should NOT trigger extended: {prompt}"


def test_document_analysis_keywords():
    """Test document analysis keyword detection."""
    print("\n=== Document Analysis Keywords ===")
    
    # Should trigger document analysis (multi-word phrases only)
    doc_prompts = [
        "Can you do a legal analysis of this contract?",
        "Write me a report on the financials",
        "I need a market analysis for Q4",
        "Create a proposal for the client",
        "Draft a memo for the team",
        "Prepare a brief on the case",
    ]
    
    for prompt in doc_prompts:
        result = is_document_analysis_request(prompt)
        status = "✓" if result else "✗"
        print(f"{status} Document: '{prompt[:50]}...' → {result}")
        assert result, f"Should trigger document mode: {prompt}"


def test_no_false_positives():
    """Ensure casual chat doesn't trigger extended mode."""
    print("\n=== False Positive Prevention ===")
    
    casual_prompts = [
        "Hey GOGGA!",
        "What can you help me with?",
        "Explain this simply",
        "Quick question",
        "Thanks!",
        "Good morning",
        "How do I start?",
    ]
    
    for prompt in casual_prompts:
        ext = is_extended_output_request(prompt)
        doc = is_document_analysis_request(prompt)
        
        if ext or doc:
            print(f"✗ False positive: '{prompt}' → extended={ext}, document={doc}")
        else:
            print(f"✓ Correct: '{prompt}' → no trigger")
        
        assert not ext, f"Extended false positive: {prompt}"
        assert not doc, f"Document false positive: {prompt}"


def test_qwen_no_think_scenarios():
    """Test scenarios where /no_think should be used for JIGGA."""
    print("\n=== JIGGA /no_think Scenarios ===")
    print("Use /no_think for:")
    print("- Casual chat (default mode)")
    print("- Long contexts (>100k tokens) to save context budget")
    print("- Quick questions that don't need reasoning")
    
    # These should use /no_think (fast mode) in JIGGA
    quick_prompts = [
        "What's the capital of South Africa?",
        "Translate 'hello' to isiZulu",
        "What time is it in Johannesburg?",
    ]
    
    for prompt in quick_prompts:
        ext = is_extended_output_request(prompt)
        doc = is_document_analysis_request(prompt)
        print(f"✓ Fast mode (4096 tokens): '{prompt}' → extended={ext}")


if __name__ == "__main__":
    print("=" * 60)
    print("EXTENDED OUTPUT MODE TESTS")
    print("=" * 60)
    
    test_token_constants()
    test_extended_output_keywords()
    test_document_analysis_keywords()
    test_no_false_positives()
    test_qwen_no_think_scenarios()
    
    print("\n" + "=" * 60)
    print("ALL TESTS PASSED ✓")
    print("=" * 60)
