"""
Test Icon Generation Service

Tests Gemini 2.0 Flash icon generation with:
- Token tracking
- SVG validation
- Branding watermark
- SA-themed prompts
- Multiple lighting/complexity combinations
"""
import pytest
import asyncio
from app.services.icon_service import IconService


@pytest.mark.asyncio
async def test_icon_generation_basic():
    """Test basic icon generation with Studio lighting."""
    result = await IconService.generate_icon(
        prompt="A protea flower with detailed petals",
        lighting="studio",
        complexity="balanced",
        backing="none"
    )
    
    assert result.svg_content is not None
    assert len(result.svg_content) > 100
    assert result.svg_content.startswith("<svg") or result.svg_content.startswith("<?xml")
    assert "</svg>" in result.svg_content
    assert "Designed by Gogga" in result.svg_content
    
    # Token tracking
    assert result.total_tokens > 0
    assert result.prompt_tokens > 0
    assert result.candidates_tokens > 0
    assert result.total_tokens == result.prompt_tokens + result.candidates_tokens
    
    # Cost tracking
    assert result.cost_usd > 0
    assert result.cost_zar > 0
    
    print(f"\n✅ Basic icon generation passed")
    print(f"   Tokens: {result.total_tokens} (prompt: {result.prompt_tokens}, output: {result.candidates_tokens})")
    print(f"   Cost: ${result.cost_usd:.6f} USD = R{result.cost_zar:.4f} ZAR")
    print(f"   SVG size: {len(result.svg_content)} bytes")


@pytest.mark.asyncio
async def test_icon_generation_sa_theme():
    """Test SA-themed icon with Rembrandt lighting."""
    result = await IconService.generate_icon(
        prompt="Ubuntu symbol with traditional beadwork patterns",
        lighting="rembrandt",
        complexity="intricate",
        backing="circle"
    )
    
    assert "Designed by Gogga" in result.svg_content
    assert result.total_tokens > 0
    
    print(f"\n✅ SA-themed icon passed")
    print(f"   Tokens: {result.total_tokens}")


@pytest.mark.asyncio
async def test_icon_generation_minimalist():
    """Test minimalist icon with neon lighting."""
    result = await IconService.generate_icon(
        prompt="Taxi icon for navigation app",
        lighting="neon",
        complexity="minimalist",
        backing="square"
    )
    
    assert "Designed by Gogga" in result.svg_content
    assert result.total_tokens > 0
    
    print(f"\n✅ Minimalist icon passed")
    print(f"   Tokens: {result.total_tokens}")


@pytest.mark.asyncio
async def test_icon_branding_watermark():
    """Test that branding watermark is always included."""
    result = await IconService.generate_icon(
        prompt="Rooibos tea icon",
        lighting="golden_hour",
        complexity="balanced",
        backing="none"
    )
    
    # Check for branding text element
    assert "Designed by Gogga" in result.svg_content
    assert "#SA Assistant" in result.svg_content or "SA Assistant" in result.svg_content
    assert "Quicksand" in result.svg_content or "sans-serif" in result.svg_content
    
    print(f"\n✅ Branding watermark verified")


@pytest.mark.asyncio
async def test_svg_validation():
    """Test SVG validation and sanitization."""
    result = await IconService.generate_icon(
        prompt="Simple star icon",
        lighting="soft",
        complexity="minimalist",
        backing="none"
    )
    
    # Should not contain markdown blocks
    assert "```svg" not in result.svg_content
    assert "```xml" not in result.svg_content
    assert "```" not in result.svg_content
    
    # Should be valid SVG
    assert "<svg" in result.svg_content
    assert "</svg>" in result.svg_content
    
    print(f"\n✅ SVG validation passed")


if __name__ == "__main__":
    print("🧪 Testing GOGGA Icon Generation Service\n")
    print("=" * 70)
    
    asyncio.run(test_icon_generation_basic())
    asyncio.run(test_icon_generation_sa_theme())
    asyncio.run(test_icon_generation_minimalist())
    asyncio.run(test_icon_branding_watermark())
    asyncio.run(test_svg_validation())
    
    print("\n" + "=" * 70)
    print("✅ All icon generation tests passed!")
