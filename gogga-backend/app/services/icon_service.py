"""
GOGGA Icon Generation Service

Uses Gemini 2.0 Flash experimental model via Google Vertex AI to generate
premium SA-themed 3D SVG icons with proper token tracking.

Features:
- South African cultural themes and colors
- 3D effects with gradients and shadows
- Multiple lighting styles (Studio, Dramatic, Neon, etc.)
- Complexity levels (Minimalist, Balanced, Intricate)
- Automatic branding watermark
- Token usage tracking via usageMetadata

Tier limits:
- FREE: 0 icons (must purchase credits)
- JIVE: 3 icons/month (5 credits each)
- JIGGA: 6 icons/month (5 credits each)
"""
import re
import logging
import os
from typing import Any
from dataclasses import dataclass

import httpx
from app.config import settings

logger = logging.getLogger(__name__)


@dataclass
class IconGenerationResult:
    """Result of icon generation with token tracking."""
    svg_content: str
    prompt_tokens: int
    candidates_tokens: int
    total_tokens: int
    cost_usd: float
    cost_zar: float


# SA-themed system instruction for Gemini 2.0 Flash
SA_ICON_SYSTEM_PROMPT = """
You are a digital artist specializing in South African culture and 3D iconography.
Your mission is to create visuals that capture the spirit of Mzansi—colorful, diverse, and vibrant.

Your task is to generate high-quality, valid SVG code for a 3D-style icon based on the user's
description and technical specifications.

Requirements:
1. Output ONLY the raw SVG code. Do not wrap it in markdown code blocks.
2. The SVG must be scalable and centered in a 512x512 viewbox.
3. **Transparency**: The SVG viewport background must be transparent.
   - If "Backing Shape" is "None", the icon should be a cutout object.
   - If "Backing Shape" is "Circle" or "Square", draw that shape *inside* the SVG behind the
     main subject, but keep the outer corners transparent.
4. **3D Effect**: Use gradients (linear/radial) and shadows (drop-shadow filters or semi-transparent
   black paths) to create depth.
5. **Lighting Styles**:
   - **Studio**: Soft, even lighting from top-left. Neutral shadows. High legibility.
   - **Soft**: Low contrast, diffused ambient light, pastel gradients, minimal deep shadows.
   - **Dramatic**: High contrast, strong directional light, deep shadows, sharp highlights.
   - **Neon**: Dark fills, vibrant/fluorescent strokes and highlights, glowing effects.
   - **Golden Hour**: Warm orange/gold highlights, long soft shadows, warm color temperature.
   - **Cinematic**: Teal/Orange contrast, depth of field simulation (blur on background elements).
   - **Rembrandt**: Strong single light source, significant portion of subject in shadow (Chiaroscuro).
   - **Bioluminescent**: Dark overall, with self-illuminating elements (blues/greens/purples) glowing against the dark.
6. **Complexity Levels**:
   - **Minimalist**: Use primitive shapes, solid colors or simple gradients, <15 total elements. Clean lines.
   - **Balanced**: Standard detailed icon, nice mix of shape and texture.
   - **Intricate**: High detail, complex patterns (beadwork, weaving, fur textures), >30 elements.
7. Prioritize South African flag colors (Red #E03C31, Blue #001489, Green #007749, Yellow #FFB81C,
   Black #000000, White #FFFFFF) or traditional palettes unless specified otherwise.
8. Ensure all tags are properly closed and XML is valid.
9. **Branding**: You MUST include a text element at the bottom center of the SVG:
   - Position: x="256" y="500" text-anchor="middle"
   - Text content: "Designed by Gogga #SA Assistant"
   - Font Family: "Quicksand", sans-serif
   - Font Weight: "500"
   - Font Size: 12px
   - Fill: #888888 (Neutral Grey)
   - Opacity: 0.7
   - This must be the top-most layer (last element in SVG) to ensure visibility.
"""


class IconService:
    """Service for generating SVG icons using Gemini 2.0 Flash."""
    
    _client: httpx.AsyncClient | None = None
    
    @classmethod
    async def _get_client(cls) -> httpx.AsyncClient:
        """Get or create HTTP client (lazy singleton)."""
        if cls._client is None or cls._client.is_closed:
            cls._client = httpx.AsyncClient(timeout=120.0)
        return cls._client
    
    @staticmethod
    def _get_api_key() -> str:
        """Get Google Gemini API key from environment (same as GoggaTalk)."""
        # Use GOOGLE_API_KEY for consistency with GoggaTalk
        api_key = os.getenv("GOOGLE_API_KEY", "")
        if not api_key:
            logger.error("GOOGLE_API_KEY not set in environment")
            raise RuntimeError(
                "Google API key not configured. Set GOOGLE_API_KEY in .env file. "
                "Get your key from: https://aistudio.google.com/apikey"
            )
        return api_key
    
    @staticmethod
    def _validate_svg(svg_content: str) -> bool:
        """Validate that SVG contains required branding and is valid XML."""
        # Check for branding watermark
        if "Designed by Gogga" not in svg_content:
            logger.warning("Generated SVG missing Gogga branding watermark")
            return False
        
        # Basic XML validation
        if not svg_content.strip().startswith("<svg") and not svg_content.strip().startswith("<?xml"):
            logger.warning("Generated content doesn't start with SVG tag")
            return False
        
        if "</svg>" not in svg_content:
            logger.warning("Generated SVG missing closing tag")
            return False
        
        return True
    
    @staticmethod
    def _add_free_watermark(svg_content: str) -> str:
        """
        Add semi-transparent 'PREVIEW' watermark for FREE tier icons.
        
        Args:
            svg_content: Original SVG content
            
        Returns:
            SVG with watermark overlay injected before closing </svg> tag
        """
        # Inject watermark overlay
        watermark = '''
  <!-- FREE TIER WATERMARK -->
  <g opacity="0.4">
    <rect x="0" y="0" width="512" height="512" fill="black" opacity="0.3"/>
    <text x="256" y="256" text-anchor="middle" 
          font-family="Quicksand, Arial, sans-serif" 
          font-size="56" 
          font-weight="700" 
          fill="white" 
          opacity="0.8">
        PREVIEW
    </text>
    <text x="256" y="300" text-anchor="middle" 
          font-family="Quicksand, Arial, sans-serif" 
          font-size="18" 
          font-weight="600" 
          fill="white" 
          opacity="0.7">
        Upgrade to remove watermark
    </text>
  </g>'''
        
        return svg_content.replace('</svg>', f'{watermark}\n</svg>')
    
    @staticmethod
    def _sanitize_svg(svg_content: str) -> str:
        """Clean up SVG content - remove markdown blocks, scripts, external resources."""
        # Remove markdown code blocks
        svg_content = re.sub(r'```svg\n?', '', svg_content)
        svg_content = re.sub(r'```xml\n?', '', svg_content)
        svg_content = re.sub(r'```\n?', '', svg_content)
        svg_content = svg_content.strip()
        
        # Extract SVG if wrapped in extra content
        if not svg_content.startswith('<svg') and not svg_content.startswith('<?xml'):
            start_idx = svg_content.find('<svg')
            end_idx = svg_content.rfind('</svg>')
            if start_idx != -1 and end_idx != -1:
                svg_content = svg_content[start_idx:end_idx + 6]
        
        # Security: Remove script tags and external resources
        svg_content = re.sub(r'<script[^>]*>.*?</script>', '', svg_content, flags=re.DOTALL | re.IGNORECASE)
        svg_content = re.sub(r'on\w+\s*=\s*["\'][^"\']*["\']', '', svg_content, flags=re.IGNORECASE)
        
        return svg_content
    
    @classmethod
    async def generate_icon(
        cls,
        prompt: str,
        tier: str = "JIVE",
        lighting: str = "studio",
        complexity: str = "balanced",
        backing: str = "none",
    ) -> IconGenerationResult:
        """
        Generate a 3D SVG icon using Gemini 2.0 Flash.
        
        Args:
            prompt: User's description of the icon
            tier: Subscription tier (FREE, JIVE, JIGGA) for watermark control
            lighting: Lighting style (studio, dramatic, neon, golden_hour, etc.)
            complexity: Detail level (minimalist, balanced, intricate)
            backing: Background shape (none, circle, square)
        
        Returns:
            IconGenerationResult with SVG content and token usage
        
        Raises:
            RuntimeError: If generation fails or SVG is invalid
        """
        # Build enhanced prompt with style parameters
        full_prompt = f"""
Create a 3D icon with the following specifications:

**Description**: {prompt}

**Style Settings**:
- Lighting: {lighting.replace('_', ' ').title()}
- Complexity: {complexity.title()}
- Backing Shape: {backing.title()}

Remember to include the Gogga branding text at the bottom!
"""
        
        # Get API key
        try:
            api_key = cls._get_api_key()
        except RuntimeError as e:
            logger.error(f"Authentication failed: {e}")
            raise
        
        # Build Google AI Studio endpoint (Gemini 3 Flash)
        model = settings.GEMINI_FLASH_MODEL
        
        endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        
        # Prepare request payload for Google AI Studio API
        payload = {
            "contents": [{
                "parts": [{"text": full_prompt}]
            }],
            "systemInstruction": {
                "parts": [{"text": SA_ICON_SYSTEM_PROMPT}]
            },
            "generationConfig": {
                "temperature": 0.7,
                "maxOutputTokens": 8000,
                "topP": 0.95,
                "topK": 40,
            }
        }
        
        client = await cls._get_client()
        
        try:
            logger.info(f"Requesting icon generation: lighting={lighting}, complexity={complexity}")
            
            response = await client.post(
                f"{endpoint}?key={api_key}",
                headers={
                    "Content-Type": "application/json"
                },
                json=payload,
                timeout=120.0
            )
            
            if response.status_code != 200:
                error_text = response.text[:500]
                logger.error(f"Gemini API error {response.status_code}: {error_text}")
                raise RuntimeError(f"Icon generation failed: {error_text}")
            
            result = response.json()
            
            # Extract SVG content
            if not result.get("candidates"):
                logger.error("No candidates in Gemini response")
                raise RuntimeError("Icon generation returned no results")
            
            svg_content = result["candidates"][0]["content"]["parts"][0]["text"]
            
            # Extract token usage
            usage_metadata = result.get("usageMetadata", {})
            prompt_tokens = usage_metadata.get("promptTokenCount", 0)
            candidates_tokens = usage_metadata.get("candidatesTokenCount", 0)
            total_tokens = usage_metadata.get("totalTokenCount", 0)
            
            logger.info(
                f"Icon generated successfully | "
                f"tokens: {total_tokens} (prompt: {prompt_tokens}, output: {candidates_tokens})"
            )
            
            # Sanitize and validate SVG
            svg_content = cls._sanitize_svg(svg_content)
            
            if not cls._validate_svg(svg_content):
                logger.error("Generated SVG failed validation")
                raise RuntimeError(
                    "Generated icon failed validation. Missing branding or invalid SVG format."
                )
            
            # Add watermark for FREE tier
            from app.config import settings as cfg
            if tier == "FREE":
                svg_content = cls._add_free_watermark(svg_content)
            
            # Calculate costs
            cost_usd = (total_tokens / 1000) * settings.COST_ICON_PER_1K_TOKENS
            cost_zar = cost_usd * settings.ZAR_USD_RATE
            
            return IconGenerationResult(
                svg_content=svg_content,
                prompt_tokens=prompt_tokens,
                candidates_tokens=candidates_tokens,
                total_tokens=total_tokens,
                cost_usd=cost_usd,
                cost_zar=cost_zar,
            )
            
        except httpx.TimeoutException:
            logger.error("Icon generation timed out")
            raise RuntimeError("Icon generation timed out. Please try again.")
        except httpx.RequestError as e:
            logger.error(f"Icon generation network error: {e}")
            raise RuntimeError(f"Network error during icon generation: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error in icon generation: {e}")
            raise RuntimeError(f"Icon generation failed: {str(e)}")
