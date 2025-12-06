"""
GOGGA Tool Execution Service

Handles backend execution of tools that require server-side processing.
Frontend-only tools (memory, charts) are handled by the frontend.
"""

import urllib.parse
import httpx
import logging
from typing import Any

logger = logging.getLogger(__name__)


# =============================================================================
# Image Generation - Pollinations.ai (Free) + FLUX (Paid)
# =============================================================================

POLLINATIONS_BASE_URL = "https://image.pollinations.ai/prompt"


async def execute_generate_image(
    prompt: str,
    style: str | None = None,
    tier: str = "free"
) -> dict[str, Any]:
    """
    Generate an image using Pollinations.ai (free) or FLUX (paid tiers).
    
    For now, all tiers use Pollinations.ai. FLUX integration can be added later.
    
    Args:
        prompt: Text description of the image to generate
        style: Optional style hint (photorealistic, artistic, etc.)
        tier: User tier (free, jive, jigga)
    
    Returns:
        dict with image_url and metadata
    """
    # Enhance prompt with style if provided
    full_prompt = prompt
    if style:
        style_hints = {
            "photorealistic": "photorealistic, highly detailed, 8k resolution",
            "artistic": "artistic, painterly, expressive brushstrokes",
            "cartoon": "cartoon style, colorful, animated",
            "sketch": "pencil sketch, hand-drawn, black and white",
            "3d-render": "3D render, CGI, volumetric lighting",
        }
        if style in style_hints:
            full_prompt = f"{prompt}, {style_hints[style]}"
    
    # URL encode the prompt
    encoded_prompt = urllib.parse.quote(full_prompt)
    
    # Pollinations.ai - just construct the URL (image is generated on request)
    image_url = f"{POLLINATIONS_BASE_URL}/{encoded_prompt}"
    
    logger.info(f"Generated image URL for prompt: {prompt[:50]}...")
    
    return {
        "success": True,
        "image_url": image_url,
        "prompt": prompt,
        "style": style,
        "provider": "pollinations",
        "note": "Image will be generated when URL is accessed"
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
