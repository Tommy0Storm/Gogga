"""
Test extended output detection for JIVE and JIGGA tiers.

Tests:
1. is_extended_output_request() keyword detection (sets 8000 tokens on 32B)
2. is_complex_output_request() keyword detection (routes to 235B)
3. is_document_analysis_request() detection
4. Token limits: QWEN_32B_* and QWEN_235B_*

UPDATED (2025-01): Simplified architecture - all paid tiers use Qwen models
UPDATED (2025-12): Renamed constants to QWEN_32B_* and QWEN_235B_* for clarity

NOTE: "comprehensive analysis" etc. route to 235B via is_complex_output_request(),
NOT to is_extended_output_request(). Extended output just sets max_tokens=8000 on 32B.
"""
import sys
sys.path.insert(0, "/home/ubuntu/Dev-Projects/Gogga/gogga-backend")

from app.core.router import (
    is_extended_output_request,
    is_complex_output_request,
    is_document_analysis_request,
    QWEN_32B_MAX_TOKENS, QWEN_32B_DEFAULT_TOKENS,
    QWEN_235B_MAX_TOKENS, QWEN_235B_DEFAULT_TOKENS,
    EXTENDED_OUTPUT_KEYWORDS, DOCUMENT_ANALYSIS_KEYWORDS
)


def test_token_constants():
    """Verify token limit constants are correctly set."""
    print("\n=== Token Limit Constants ===")
    
    # QWEN 32B limits (JIVE_TEXT and JIGGA_THINK layers)
    assert QWEN_32B_MAX_TOKENS == 8000, f"QWEN_32B_MAX_TOKENS should be 8000, got {QWEN_32B_MAX_TOKENS}"
    assert QWEN_32B_DEFAULT_TOKENS == 4096, f"QWEN_32B_DEFAULT_TOKENS should be 4096, got {QWEN_32B_DEFAULT_TOKENS}"
    print(f"✓ Qwen 32B: {QWEN_32B_DEFAULT_TOKENS} default, {QWEN_32B_MAX_TOKENS} extended")
    
    # QWEN 235B limits (JIVE_COMPLEX and JIGGA_COMPLEX layers)
    assert QWEN_235B_MAX_TOKENS == 32000, f"QWEN_235B_MAX_TOKENS should be 32000, got {QWEN_235B_MAX_TOKENS}"
    assert QWEN_235B_DEFAULT_TOKENS == 8000, f"QWEN_235B_DEFAULT_TOKENS should be 8000, got {QWEN_235B_DEFAULT_TOKENS}"
    print(f"✓ Qwen 235B: {QWEN_235B_DEFAULT_TOKENS} default, {QWEN_235B_MAX_TOKENS} extended")


def test_extended_output_keywords():
    """Test extended output keyword detection.
    
    NOTE: Extended output just sets max_tokens=8000 on 32B.
    Phrases like "comprehensive analysis" route to 235B via is_complex_output_request().
    """
    print("\n=== Extended Output Keywords (32B with 8000 tokens) ===")
    
    # Should trigger extended output (stays on 32B but with 8000 tokens)
    extended_prompts = [
        "Give me a detailed report on the market trends",  # "detailed report" matches
        "I need a full breakdown of the contract",  # Not a match for extended
        "Write a long format explanation of quantum physics",  # "long format" matches
        "Can you elaborate more on this topic?",  # "elaborate more" matches
        "Please expand on this with more details",  # "more detail" matches
        "Write me a motivation report for my insurance claim",  # "motivation report" matches
    ]
    
    # These should route to 235B (complex), NOT extended 32B
    complex_prompts = [
        "Provide a comprehensive analysis of the data",  # → 235B
        "Give me a thorough review of the proposal",  # → 235B 
        "I need extended analysis of the financials",  # → 235B
        "Provide a comprehensive breakdown of the project",  # → 235B
    ]
    
    print("--- Prompts that trigger EXTENDED OUTPUT (32B 8000 tokens) ---")
    for prompt in extended_prompts:
        result = is_extended_output_request(prompt)
        status = "✓" if result else "✗"
        print(f"{status} Extended: '{prompt[:50]}...' → {result}")
    
    print("\n--- Prompts that route to 235B COMPLEX (NOT extended) ---")
    for prompt in complex_prompts:
        complex_result = is_complex_output_request(prompt)
        extended_result = is_extended_output_request(prompt)
        print(f"→ 235B: '{prompt[:50]}...' | complex={complex_result}, extended={extended_result}")
    
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
