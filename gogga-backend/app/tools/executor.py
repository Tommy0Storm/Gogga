"""
GOGGA Tool Execution Service

Handles backend execution of tools that require server-side processing.
Frontend-only tools (memory, charts) are handled by the frontend.
"""

import asyncio
import os
import time
import urllib.parse
import httpx
import logging
from typing import Any

logger = logging.getLogger(__name__)


# =============================================================================
# Image Generation - Pollinations.ai + AI Horde (Dual Free Generators)
# =============================================================================

POLLINATIONS_BASE_URL = "https://image.pollinations.ai/prompt"

# AI Horde settings
AI_HORDE_API_URL = "https://aihorde.net/api/v2"
AI_HORDE_API_KEY = os.getenv("AI_HORDE_API_KEY", "0000000000")
AI_HORDE_TIMEOUT = 30.0  # Reasonable timeout for registered users
AI_HORDE_POLL_INTERVAL = 2.0


async def _generate_horde_image(prompt: str) -> str | None:
    """
    Generate image via AI Horde (community-powered, free).
    Returns image URL on success, None on failure (silently handles errors).
    Includes retry logic for 429 rate limits.
    """
    max_retries = 2  # Reduced from 3 to be faster
    
    # Create client once outside retry loop for efficiency
    timeout = httpx.Timeout(10.0, connect=5.0)  # 5s connect, 10s total per request
    
    for attempt in range(max_retries):
        try:
            async with httpx.AsyncClient(
                timeout=timeout,
                headers={
                    "Content-Type": "application/json",
                    "apikey": AI_HORDE_API_KEY,
                    "Client-Agent": "Gogga:1.0:gogga@southafrica.ai",
                }
            ) as client:
                # Submit async generation request with HD quality settings
                # Negative prompt for best quality output
                negative_prompt = "lowres, text, error, cropped, worst quality, low quality, jpeg artifacts, ugly, duplicate, blurry, bad anatomy, watermark, signature"
                
                generate_payload = {
                    "prompt": prompt,
                    "params": {
                        "cfg_scale": 7.5,
                        "sampler_name": "k_euler",
                        "height": 512,
                        "width": 512,
                        "steps": 20,  # Increased for better quality
                        "karras": True,
                        "n": 1
                    },
                    "nsfw": False,
                    "censor_nsfw": True,
                    "trusted_workers": False,  # Allow all workers for faster processing
                    "models": [],  # Empty = any model, faster queue
                    "r2": True,
                    "shared": False,
                    "slow_workers": True,  # Allow slow workers for availability
                    "replacement_filter": True  # Filter bad quality outputs
                }
                
                logger.debug("AI Horde: Submitting request (attempt %d)", attempt + 1)
                response = await client.post(
                    f"{AI_HORDE_API_URL}/generate/async",
                    json=generate_payload
                )
                
                if response.status_code == 429:
                    # Rate limited - wait and retry
                    retry_after = int(response.headers.get("Retry-After", 3))
                    logger.debug("AI Horde rate limited, retrying in %ds (attempt %d/%d)", retry_after, attempt + 1, max_retries)
                    await asyncio.sleep(retry_after)
                    continue
                
                if response.status_code != 202:
                    logger.debug("AI Horde submit failed (%s): %s", response.status_code, response.text)
                    return None
                
                result = response.json()
                request_id = result.get("id")
                if not request_id:
                    return None
                
                logger.debug("AI Horde request submitted: %s", request_id)
                
                # Poll for completion
                start = time.monotonic()
                while time.monotonic() - start < AI_HORDE_TIMEOUT:
                    check_response = await client.get(
                        f"{AI_HORDE_API_URL}/generate/check/{request_id}"
                    )
                    
                    if check_response.status_code != 200:
                        await asyncio.sleep(AI_HORDE_POLL_INTERVAL)
                        continue
                    
                    check_data = check_response.json()
                    if check_data.get("finished", 0) >= 1:
                        break
                    if check_data.get("faulted"):
                        logger.debug("AI Horde generation faulted")
                        return None
                        
                    await asyncio.sleep(AI_HORDE_POLL_INTERVAL)
                else:
                    # Timeout - cancel request silently
                    logger.debug("AI Horde timeout, cancelling")
                    await client.delete(f"{AI_HORDE_API_URL}/generate/status/{request_id}")
                    return None
                
                # Get completed image
                status_response = await client.get(
                    f"{AI_HORDE_API_URL}/generate/status/{request_id}"
                )
                
                if status_response.status_code != 200:
                    return None
                
                status_data = status_response.json()
                generations = status_data.get("generations", [])
                
                if generations and generations[0].get("img"):
                    logger.info("AI Horde image generated successfully")
                    return generations[0]["img"]
                
                return None
                
        except Exception as e:
            logger.debug("AI Horde error (silent): %s", e)
            if attempt < max_retries - 1:
                await asyncio.sleep(2)  # Brief pause before retry
                continue
            return None
    
    return None


# HD Quality enhancement keywords
HD_QUALITY_SUFFIX = ", masterpiece, best quality, highly detailed, sharp focus, HD, 4K"

async def execute_generate_image(
    prompt: str,
    style: str | None = None,
    tier: str = "free"
) -> dict[str, Any]:
    """
    Generate images using BOTH Pollinations.ai AND AI Horde in parallel.
    
    Returns all successful images. If one fails, silently returns the other.
    User never sees errors - at least one image will always be returned.
    
    Args:
        prompt: Text description of the image to generate
        style: Optional style hint (photorealistic, artistic, etc.)
        tier: User tier (free, jive, jigga)
    
    Returns:
        dict with image_urls (array) and metadata
    """
    # Enhance prompt with style if provided
    full_prompt = prompt
    if style:
        style_hints = {
            "photorealistic": "photorealistic, highly detailed, 8k resolution, professional photography",
            "artistic": "artistic, painterly, expressive brushstrokes, fine art",
            "cartoon": "cartoon style, colorful, animated, vibrant",
            "sketch": "pencil sketch, hand-drawn, detailed linework",
            "3d-render": "3D render, CGI, volumetric lighting, octane render",
        }
        if style in style_hints:
            full_prompt = f"{prompt}, {style_hints[style]}"
    
    # Add HD quality suffix for maximum quality
    full_prompt = f"{full_prompt}{HD_QUALITY_SUFFIX}"
    
    # URL encode for Pollinations with HD parameters
    encoded_prompt = urllib.parse.quote(full_prompt)
    # Add quality parameters: enhance=true for AI enhancement, nologo=true, larger size
    pollinations_url = f"{POLLINATIONS_BASE_URL}/{encoded_prompt}?enhance=true&nologo=true&width=1024&height=1024"
    
    # Fire both generators in parallel
    horde_task = asyncio.create_task(_generate_horde_image(full_prompt))
    
    # Collect all successful image URLs
    image_urls = [pollinations_url]  # Pollinations always "succeeds" (URL-based)
    
    # Wait for Horde (with extra buffer for task overhead)
    try:
        horde_url = await asyncio.wait_for(horde_task, timeout=AI_HORDE_TIMEOUT + 5)
        if horde_url:
            image_urls.append(horde_url)
            logger.info("Tool calling: Both Pollinations and AI Horde succeeded")
        else:
            logger.debug("Tool calling: AI Horde returned None (Pollinations only)")
    except asyncio.TimeoutError:
        logger.debug("Tool calling: AI Horde timed out (Pollinations only)")
    except Exception as e:
        logger.debug("Tool calling: AI Horde error (silent): %s", e)
    
    logger.info(f"Generated {len(image_urls)} image(s) for prompt: {prompt[:50]}...")
    
    return {
        "success": True,
        "image_url": image_urls[0],  # Primary (Pollinations)
        "image_urls": image_urls,  # All successful images
        "prompt": prompt,
        "style": style,
        "providers": ["pollinations"] + (["ai-horde"] if len(image_urls) > 1 else []),
        "image_count": len(image_urls),
        "note": "Image(s) generated from dual free providers"
    }


# =============================================================================
# Chart Creation - Returns data for frontend rendering
# =============================================================================

def execute_create_chart(
    chart_type: str,
    title: str,
    data: list[dict],
    x_label: str | None = None,
    y_label: str | None = None,
    colors: list[str] | None = None
) -> dict[str, Any]:
    """
    Prepare chart data for frontend rendering with Recharts.
    
    This doesn't actually create the chart - it validates and formats
    the data, which the frontend will render.
    
    Args:
        chart_type: Type of chart (line, bar, pie, area, scatter)
        title: Chart title
        data: Array of data points
        x_label: Optional X axis label
        y_label: Optional Y axis label
        colors: Optional array of colors
    
    Returns:
        dict with formatted chart configuration
    """
    # Validate chart type
    valid_types = ["line", "bar", "pie", "area", "scatter"]
    if chart_type not in valid_types:
        return {
            "success": False,
            "error": f"Invalid chart type. Must be one of: {valid_types}"
        }
    
    # Validate data
    if not data or not isinstance(data, list):
        return {
            "success": False,
            "error": "Data must be a non-empty array"
        }
    
    # Default colors (SA-inspired palette)
    default_colors = [
        "#1a1a1a",  # Black
        "#4a4a4a",  # Dark gray
        "#6a6a6a",  # Medium gray
        "#8a8a8a",  # Light gray
        "#2563eb",  # Blue accent
        "#dc2626",  # Red accent
        "#16a34a",  # Green accent
        "#ca8a04",  # Gold accent
    ]
    
    chart_config = {
        "success": True,
        "chart_type": chart_type,
        "title": title,
        "data": data,
        "x_label": x_label,
        "y_label": y_label,
        "colors": colors or default_colors[:len(data)],
        "render_on": "frontend",  # Indicates frontend should render this
    }
    
    logger.info(f"Created chart config: {chart_type} with {len(data)} data points")
    
    return chart_config


# =============================================================================
# Tool Execution Router
# =============================================================================

async def execute_backend_tool(
    tool_name: str,
    arguments: dict[str, Any],
    tier: str = "free"
) -> dict[str, Any]:
    """
    Execute a backend tool and return the result.
    
    Args:
        tool_name: Name of the tool to execute
        arguments: Tool arguments
        tier: User tier
    
    Returns:
        Tool execution result
    """
    if tool_name == "generate_image":
        return await execute_generate_image(
            prompt=arguments.get("prompt", ""),
            style=arguments.get("style"),
            tier=tier
        )
    
    elif tool_name == "create_chart":
        return execute_create_chart(
            chart_type=arguments.get("chart_type", "bar"),
            title=arguments.get("title", "Chart"),
            data=arguments.get("data", []),
            x_label=arguments.get("x_label"),
            y_label=arguments.get("y_label"),
            colors=arguments.get("colors")
        )
    
    else:
        return {
            "success": False,
            "error": f"Unknown tool: {tool_name}",
            "execute_on": "frontend"  # Try frontend execution
        }
