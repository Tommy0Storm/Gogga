"""
Quick Icon Generation Test

Test the Gemini 2.0 Flash icon service with a single SA-themed icon.
"""
import sys
import os
import asyncio

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.icon_service import IconService


async def main():
    print("🧪 GOGGA Icon Generation - Quick Test")
    print("=" * 70)
    print("Using Gemini 2.0 Flash experimental model")
    print()
    
    try:
        print("🎨 Generating SA-themed protea flower icon...")
        result = await IconService.generate_icon(
            prompt="A beautiful protea flower with detailed petals and South African flag colors",
            lighting="golden_hour",
            complexity="balanced",
            backing="circle"
        )
        
        print(f"\n✅ Icon generated successfully!")
        print(f"   Tokens: {result.total_tokens:,} total")
        print(f"   - Prompt: {result.prompt_tokens:,}")
        print(f"   - Output: {result.candidates_tokens:,}")
        print(f"   Cost: ${result.cost_usd:.6f} USD = R{result.cost_zar:.4f} ZAR")
        print(f"   SVG size: {len(result.svg_content):,} bytes")
        
        # Validate
        assert "<svg" in result.svg_content, "Missing <svg tag"
        assert "</svg>" in result.svg_content, "Missing </svg> tag"
        assert "Designed by Gogga" in result.svg_content, "Missing branding watermark"
        
        print(f"\n✅ Validation passed")
        print(f"   - Valid SVG structure")
        print(f"   - Branding watermark present")
        
        # Save to file
        output_file = "/tmp/gogga_test_icon.svg"
        with open(output_file, "w") as f:
            f.write(result.svg_content)
        
        print(f"\n📁 Saved to: {output_file}")
        print(f"   View with: firefox {output_file}")
        
        print("\n" + "=" * 70)
        print("🎉 Icon generation test PASSED!")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)
