#!/usr/bin/env python3
"""
Test script for GOGGA Gemini Service (Vertex AI)

Demonstrates:
1. Simple generation with thinking mode
2. Google Search grounding
3. Streaming response
4. Tier-based thinking budget

Usage:
    # From gogga-backend directory with venv activated:
    python test_gemini_service.py
    
    # Or with Docker:
    docker exec -it gogga-backend python test_gemini_service.py
"""
import asyncio
import os
import sys

# Add app to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


async def test_simple_generation():
    """Test basic text generation with thinking mode."""
    from app.services.gemini_service import gemini_service
    from app.core.router import UserTier
    
    print("\n" + "=" * 60)
    print("🧪 Test 1: Simple Generation with Thinking")
    print("=" * 60)
    
    response = await gemini_service.generate(
        prompt="Explain POPIA section 19 in simple terms for a South African small business owner.",
        tier=UserTier.JIGGA,
        include_thoughts=True,
    )
    
    print(f"\n📝 Response ({len(response.text)} chars):")
    print(response.text[:500] + "..." if len(response.text) > 500 else response.text)
    
    if response.thinking:
        print(f"\n💭 Thinking ({len(response.thinking)} chars):")
        print(response.thinking[:300] + "..." if len(response.thinking) > 300 else response.thinking)
    
    if response.usage:
        print(f"\n📊 Usage: {response.usage}")
    
    print(f"\n🤖 Model: {response.model}")


async def test_google_search_grounding():
    """Test generation with Google Search grounding."""
    from app.services.gemini_service import gemini_service
    from app.core.router import UserTier
    
    print("\n" + "=" * 60)
    print("🧪 Test 2: Google Search Grounding")
    print("=" * 60)
    
    response = await gemini_service.generate(
        prompt="What is the current load shedding stage in South Africa today?",
        tier=UserTier.JIVE,
        use_google_search=True,
    )
    
    print(f"\n📝 Response:")
    print(response.text[:500] + "..." if len(response.text) > 500 else response.text)
    
    if response.grounding_metadata:
        print(f"\n🔍 Search Queries: {response.grounding_metadata.get('web_search_queries', [])}")
        chunks = response.grounding_metadata.get('grounding_chunks', [])
        if chunks:
            print(f"📚 Sources ({len(chunks)}):")
            for chunk in chunks[:3]:
                print(f"  - {chunk.get('title', 'N/A')}: {chunk.get('uri', 'N/A')}")


async def test_streaming():
    """Test streaming generation."""
    from app.services.gemini_service import gemini_service
    from app.core.router import UserTier
    
    print("\n" + "=" * 60)
    print("🧪 Test 3: Streaming Response")
    print("=" * 60)
    
    print("\n📝 Streaming response:")
    
    char_count = 0
    async for chunk in gemini_service.generate_stream(
        prompt="Write a short poem about Table Mountain in Cape Town.",
        tier=UserTier.JIVE,
    ):
        if chunk.text:
            print(chunk.text, end="", flush=True)
            char_count += len(chunk.text)
        if chunk.is_complete:
            print(f"\n\n✅ Complete! ({char_count} chars)")


async def test_tier_differences():
    """Test thinking budget differences between tiers."""
    from app.services.gemini_service import gemini_service, get_tier_thinking_budget
    from app.core.router import UserTier
    from app.config import settings
    
    print("\n" + "=" * 60)
    print("🧪 Test 4: Tier-Based Thinking Budget")
    print("=" * 60)
    
    for tier in [UserTier.FREE, UserTier.JIVE, UserTier.JIGGA]:
        budget = get_tier_thinking_budget(tier, settings)
        print(f"  {tier.value.upper()}: {budget} tokens thinking budget")


async def main():
    """Run all tests."""
    print("\n🚀 GOGGA Gemini Service Test Suite")
    print("=" * 60)
    print("Using Vertex AI with google-genai SDK")
    
    try:
        # Test 1: Simple generation
        await test_simple_generation()
        
        # Test 2: Google Search
        await test_google_search_grounding()
        
        # Test 3: Streaming
        await test_streaming()
        
        # Test 4: Tier differences
        await test_tier_differences()
        
        print("\n" + "=" * 60)
        print("✅ All tests completed!")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
