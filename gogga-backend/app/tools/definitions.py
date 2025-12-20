"""
GOGGA Tool Definitions

OpenAI-compatible tool schemas for Cerebras API.
These tools are called by the AI and executed on the frontend or backend.

Tool Flow:
1. AI receives user message + tool definitions
2. AI decides to call a tool (returns tool_calls in response)
3. Backend executes server-side tools (search, math) OR returns to frontend
4. Frontend executes client-side tools (memory, image, charts)
5. Tool result injected back into conversation
"""

from typing import TypedDict, Any
from dataclasses import dataclass

# Import math tool definitions
from app.tools.math_definitions import (
    MATH_STATISTICS_TOOL,
    MATH_FINANCIAL_TOOL,
    MATH_SA_TAX_TOOL,
    MATH_FRAUD_TOOL,
    MATH_TOOLS,
    FREE_MATH_TOOLS,
    JIVE_MATH_TOOLS,
    JIGGA_MATH_TOOLS,
    JIGGA_235B_MATH_TOOLS,  # For 235B model with math_delegate
)

# Import search tool definitions
from app.tools.search_definitions import (
    SEARCH_TOOL,
    LEGAL_SEARCH_TOOL,
    SHOPPING_SEARCH_TOOL,
    PLACES_SEARCH_TOOL,
    SEARCH_TOOLS,
    get_search_tools,
)

# Import document tool definition
from app.tools.document_definitions import DOCUMENT_TOOL_DEFINITION


class ToolParameter(TypedDict, total=False):
    type: str
    description: str
    enum: list[str]


class ToolParameters(TypedDict):
    type: str  # "object"
    properties: dict[str, ToolParameter]
    required: list[str]


class ToolFunction(TypedDict):
    name: str
    strict: bool
    description: str
    parameters: ToolParameters


class ToolDefinition(TypedDict):
    type: str  # "function"
    function: ToolFunction


# =============================================================================
# Memory Tools - Execute on Frontend (IndexedDB)
# =============================================================================

SAVE_MEMORY_TOOL: ToolDefinition = {
    "type": "function",
    "function": {
        "name": "save_memory",
        "strict": True,
        "description": (
            "Save important information about the user to long-term memory. "
            "Use this when the user asks you to remember something, tells you their name, "
            "shares personal preferences, or provides information they want you to recall later. "
            "Examples: 'Remember my name is John', 'I prefer dark mode', 'My project uses Python'."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "title": {
                    "type": "string",
                    "description": (
                        "Short title for the memory (max 50 chars). "
                        "Examples: 'User name is John', 'Prefers dark mode', 'Uses Python for work'"
                    )
                },
                "content": {
                    "type": "string",
                    "description": (
                        "Detailed content to remember. Include context and details. "
                        "Examples: 'The user's name is John. Always address them by name when appropriate.'"
                    )
                },
                "category": {
                    "type": "string",
                    "description": "Category for the memory",
                    "enum": ["personal", "project", "reference", "custom"]
                },
                "priority": {
                    "type": "integer",
                    "description": "Priority 1-10, where 10 is most important. Use 8-10 for names/identity.",
                }
            },
            "required": ["title", "content", "category", "priority"],
            "additionalProperties": False
        }
    }
}

DELETE_MEMORY_TOOL: ToolDefinition = {
    "type": "function",
    "function": {
        "name": "delete_memory",
        "strict": True,
        "description": (
            "Delete a memory that GOGGA previously created. "
            "Use this when the user says information is wrong or asks to forget something. "
            "Can only delete memories created by GOGGA (source='gogga'), not user-created memories."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "memory_title": {
                    "type": "string",
                    "description": "The title of the memory to delete (exact or partial match)"
                },
                "reason": {
                    "type": "string",
                    "description": "Brief reason for deletion"
                }
            },
            "required": ["memory_title", "reason"],
            "additionalProperties": False
        }
    }
}


# =============================================================================
# Image Generation Tools - Execute on Backend
# =============================================================================

GENERATE_IMAGE_TOOL: ToolDefinition = {
    "type": "function",
    "function": {
        "name": "generate_image",
        "strict": True,
        "description": (
            "Generate an image from a text description using AI. "
            "Use this when the user asks you to create, draw, generate, or make an image. "
            "IMPORTANT: The prompt must ONLY describe what the user explicitly asked for. "
            "Do NOT inject user memories, preferences, or unrelated context into the image prompt. "
            "If user says 'draw a superhero', the prompt should be about superheroes only."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "prompt": {
                    "type": "string",
                    "description": (
                        "Detailed description of ONLY what the user asked for in English. "
                        "Do NOT add user memories or unrelated personal context. "
                        "Be specific about style, colors, composition, and details. "
                        "Example: 'A vibrant African sunset over the Johannesburg skyline, "
                        "with orange and purple clouds, photorealistic style'"
                    )
                },
                "style": {
                    "type": "string",
                    "description": "Optional style hint for the image",
                    "enum": ["photorealistic", "artistic", "cartoon", "sketch", "3d-render"]
                }
            },
            "required": ["prompt"],
            "additionalProperties": False
        }
    }
}


# =============================================================================
# Premium Image Tools - Execute on Backend (Vertex AI Imagen)
# JIVE/JIGGA tiers only - Uses Imagen 3.0 for editing, Imagen 4.0 for upscaling
# =============================================================================

UPSCALE_IMAGE_TOOL: ToolDefinition = {
    "type": "function",
    "function": {
        "name": "upscale_image",
        "strict": True,
        "description": (
            "Upscale an existing image to higher resolution using Imagen 4 Ultra. "
            "Use this when the user asks to enhance, upscale, increase resolution, "
            "make larger, or improve quality of an image they've provided or previously generated. "
            "JIVE/JIGGA tier required. Available upscale factors: x2, x3, x4. "
            "Example triggers: 'upscale this image', 'make it higher resolution', 'enhance this photo'."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "source_image_id": {
                    "type": "string",
                    "description": (
                        "ID of the previously generated image to upscale. "
                        "Use the image ID from a recent generate_image call or user-provided image."
                    )
                },
                "upscale_factor": {
                    "type": "string",
                    "description": "Upscale factor - how much to increase resolution",
                    "enum": ["x2", "x3", "x4"]
                }
            },
            "required": ["source_image_id", "upscale_factor"],
            "additionalProperties": False
        }
    }
}

EDIT_IMAGE_TOOL: ToolDefinition = {
    "type": "function",
    "function": {
        "name": "edit_image",
        "strict": True,
        "description": (
            "Edit an existing image with AI using mask-based inpainting or outpainting. "
            "Use when the user wants to modify, change, add, remove, or extend parts of an image. "
            "JIVE/JIGGA tier required. Requires a source image and edit prompt. "
            "Edit modes: INPAINT_INSERTION (add objects), INPAINT_REMOVAL (remove objects), "
            "BGSWAP (change background), OUTPAINT (extend image boundaries). "
            "Example triggers: 'remove that person', 'add a tree here', 'change the background', "
            "'extend this image to the right'."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "source_image_id": {
                    "type": "string",
                    "description": (
                        "ID of the image to edit. Use the image ID from a recent "
                        "generate_image call or user-provided image."
                    )
                },
                "edit_prompt": {
                    "type": "string",
                    "description": (
                        "Description of the edit to make. Be specific about what to add, "
                        "remove, or change. Example: 'Replace the sky with a sunset', "
                        "'Remove the person on the left', 'Add a mountain in the background'."
                    )
                },
                "edit_mode": {
                    "type": "string",
                    "description": "Type of edit operation to perform",
                    "enum": ["INPAINT_INSERTION", "INPAINT_REMOVAL", "BGSWAP", "OUTPAINT"]
                },
                "mask_description": {
                    "type": "string",
                    "description": (
                        "Optional natural language description of where to apply the edit. "
                        "Example: 'the sky area', 'the person on the left', 'the empty space on the right'. "
                        "If not provided, user will be prompted to draw a mask."
                    )
                }
            },
            "required": ["source_image_id", "edit_prompt", "edit_mode"],
            "additionalProperties": False
        }
    }
}


# =============================================================================
# Video Generation Tools - Execute on Frontend (calls backend Veo API)
# =============================================================================

GENERATE_VIDEO_TOOL: ToolDefinition = {
    "type": "function",
    "function": {
        "name": "generate_video",
        "strict": True,
        "description": (
            "Generate a short video from a text description using AI (Veo 3.1). "
            "Use this when the user explicitly asks for a VIDEO, not an image. "
            "Videos are 5-8 seconds long and take 30-60 seconds to generate. "
            "JIVE tier: 5 minutes/month of video. JIGGA tier: 20 minutes/month. "
            "FREE tier cannot generate videos - inform user to upgrade. "
            "Do NOT use this for image requests - use generate_image instead."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "prompt": {
                    "type": "string",
                    "description": (
                        "Detailed description of the video scene in English. "
                        "Describe the motion, camera movement, and action. "
                        "Example: 'A drone flying over the Johannesburg skyline at sunset, "
                        "camera slowly panning from left to right, golden hour lighting'"
                    )
                },
                "generate_audio": {
                    "type": "boolean",
                    "description": "Whether to generate audio with the video. JIVE/JIGGA only. Default: true"
                },
                "style": {
                    "type": "string",
                    "description": "Visual style for the video",
                    "enum": ["cinematic", "realistic", "animated", "abstract"]
                }
            },
            "required": ["prompt"],
            "additionalProperties": False
        }
    }
}


# =============================================================================
# Chart/Visualization Tools - Execute on Frontend (Recharts)
# =============================================================================

CREATE_CHART_TOOL: ToolDefinition = {
    "type": "function",
    "function": {
        "name": "create_chart",
        "strict": True,
        "description": (
            "Create an interactive chart or graph to visualize data. "
            "ONLY use when user EXPLICITLY requests a visual chart/graph (not for 'analyze' or 'report' requests). "
            "CRITICAL: For 'analyze', 'report', 'summary' requests, provide TEXT analysis instead - "
            "charts are OPTIONAL supplements to text, never replacements. "
            "ALWAYS include a text explanation when using this tool - never return ONLY a chart with empty response. "
            "Trigger words FOR chart: 'chart', 'graph', 'visualize', 'pie chart', 'bar chart'. "
            "Trigger words AGAINST chart (use text): 'analyze', 'report', 'summary', 'explain', 'breakdown'. "
            "Examples: 'Show as pie chart' → use chart. 'Analyze my data' → use text analysis."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "chart_type": {
                    "type": "string",
                    "description": (
                        "The type of chart to create. "
                        "Basic: bar, line, area, pie, scatter. "
                        "Stacked: stackedBar (multi-series stacked), stackedLine, stackedArea. "
                        "Variants: horizontalBar, smoothLine, multiArea, donut. "
                        "Special: radar, radialBar, composed (bar+line+area), funnel, treemap."
                    ),
                    "enum": [
                        "bar", "stackedBar", "horizontalBar",
                        "line", "stackedLine", "smoothLine",
                        "area", "stackedArea", "multiArea",
                        "pie", "donut",
                        "scatter", "radar", "radialBar",
                        "composed", "funnel", "treemap"
                    ]
                },
                "title": {
                    "type": "string",
                    "description": "Title for the chart"
                },
                "subtitle": {
                    "type": "string",
                    "description": "Optional subtitle or description for the chart"
                },
                "data": {
                    "type": "array",
                    "description": (
                        "Array of data points. CRITICAL: For COMPARISON charts (comparing scenarios, options, projections), "
                        "use MULTI-SERIES format with value, value2, value3... where each valueX is a different scenario. "
                        "Single series: [{name: 'Jan', value: 100}] - for showing one metric over time. "
                        "Multi-series (REQUIRED for comparisons): [{name: 'Year 1', value: 100, value2: 80}, {name: 'Year 2', value: 120, value2: 96}] "
                        "- use 'name' as the x-axis (time period), 'value' for first scenario, 'value2' for second, etc. "
                        "This ensures charts work correctly when user switches between bar/line/area views. "
                        "For scatter: [{name: 'Point 1', x: 1, y: 2}]. "
                        "For pie/donut: [{name: 'Category A', value: 50}]."
                    ),
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string", "description": "Label for this data point (x-axis category)"},
                            "value": {"type": "number", "description": "Primary numeric value for this data point"},
                            "x": {"type": "number", "description": "X coordinate for scatter plots"},
                            "y": {"type": "number", "description": "Y coordinate for scatter plots"},
                            "value2": {"type": "number", "description": "Secondary value (for multi-series charts - 2nd series)"},
                            "value3": {"type": "number", "description": "Tertiary value (for multi-series charts - 3rd series)"},
                            "value4": {"type": "number", "description": "Fourth value (for multi-series charts - 4th series)"},
                            "value5": {"type": "number", "description": "Fifth value (for multi-series charts - 5th series)"}
                        },
                        "additionalProperties": False,
                        "required": []
                    }
                },
                "series": {
                    "type": "array",
                    "description": (
                        "Optional. Configuration for multiple data series (for stacked/multi-series charts). "
                        "Each series maps to a key in the data objects."
                    ),
                    "items": {
                        "type": "object",
                        "properties": {
                            "dataKey": {"type": "string", "description": "Key in data: 'value' for first series, 'value2' for second, etc. up to 'value5'", "enum": ["value", "value2", "value3", "value4", "value5"]},
                            "name": {"type": "string", "description": "Display name for the series"},
                            "color": {"type": "string", "description": "Hex color for this series (e.g., #FF5733)"},
                            "type": {
                                "type": "string",
                                "description": "Rendering type for composed charts",
                                "enum": ["bar", "line", "area"]
                            }
                        },
                        "required": ["dataKey", "name"],
                        "additionalProperties": False
                    }
                },
                "x_label": {
                    "type": "string",
                    "description": "Label for the X axis (optional)"
                },
                "y_label": {
                    "type": "string",
                    "description": "Label for the Y axis (optional)"
                },
                "colors": {
                    "type": "array",
                    "description": "Optional array of colors for the chart (hex codes like #FF5733). Auto-assigned if not provided.",
                    "items": {"type": "string"}
                },
                "legendPosition": {
                    "type": "string",
                    "description": "Position of the legend. Auto-positioned based on chart type if not specified.",
                    "enum": ["top", "bottom", "left", "right", "none"]
                },
                "showGrid": {
                    "type": "boolean",
                    "description": "Whether to show grid lines. Default true."
                }
            },
            "required": ["chart_type", "title", "data"],
            "additionalProperties": False
        }
    }
}


# =============================================================================
# All Available Tools
# =============================================================================

# Memory tools - JIGGA only
MEMORY_TOOLS: list[ToolDefinition] = [
    SAVE_MEMORY_TOOL,
    DELETE_MEMORY_TOOL,
]

# Video tools - JIVE/JIGGA only (requires paid tier)
VIDEO_TOOLS: list[ToolDefinition] = [
    GENERATE_VIDEO_TOOL,
]

# Premium image tools - JIVE/JIGGA only (Imagen 3.0 edit, Imagen 4.0 upscale)
PREMIUM_IMAGE_TOOLS: list[ToolDefinition] = [
    UPSCALE_IMAGE_TOOL,
    EDIT_IMAGE_TOOL,
]

# Tools available to all tiers (image + chart)
UNIVERSAL_TOOLS: list[ToolDefinition] = [
    GENERATE_IMAGE_TOOL,
    CREATE_CHART_TOOL,
]

# Paid tier tools (image + chart + video + premium image)
PAID_TIER_TOOLS: list[ToolDefinition] = UNIVERSAL_TOOLS + VIDEO_TOOLS + PREMIUM_IMAGE_TOOLS

# All tools combined (non-math, non-search)
GOGGA_TOOLS: list[ToolDefinition] = MEMORY_TOOLS + PAID_TIER_TOOLS

# All tools including math and search (+ premium image tools for ALL_TOOLS)
ALL_TOOLS: list[ToolDefinition] = GOGGA_TOOLS + MATH_TOOLS + SEARCH_TOOLS

# Tool name to definition mapping (includes all tools)
TOOL_MAP: dict[str, ToolDefinition] = {
    tool["function"]["name"]: tool for tool in ALL_TOOLS
}

# Server-side tools (executed on backend, not frontend)
# These tools require the AI to PAUSE and WAIT for results before continuing
SERVER_SIDE_TOOLS: set[str] = {
    # Search tools - require server-side API calls
    "web_search",
    "legal_search", 
    "shopping_search",
    "places_search",
    # Math tools are also server-side
    "math_statistics",
    "math_financial",
    "math_sa_tax",
    "math_fraud_detection",
    "math_delegate",
    # Document tool - generates professional documents
    "generate_document",
    # Premium image tools - Imagen 3.0/4.0 on Vertex AI
    "upscale_image",
    "edit_image",
}


def get_tool_by_name(name: str) -> ToolDefinition | None:
    """Get a tool definition by name."""
    return TOOL_MAP.get(name)


def is_server_side_tool(tool_name: str) -> bool:
    """Check if a tool should be executed on the server."""
    return tool_name in SERVER_SIDE_TOOLS


# Document tool list (for paid tiers)
DOCUMENT_TOOLS: list[ToolDefinition] = [DOCUMENT_TOOL_DEFINITION]


def get_tools_for_tier(tier: str, model: str = "") -> list[ToolDefinition]:
    """
    Get tools available for a specific tier and model.
    
    - FREE: Universal tools (image, chart) + basic math + basic search
    - JIVE: Universal + math + all search + document tool
    - JIGGA (32B): All tools (memory + image + charts + all math + all search + document)
    - JIGGA (235B): All JIGGA tools + math_delegate for delegating to 32B
    
    Args:
        tier: User tier (free, jive, jigga)
        model: Model name - if contains "235" uses 235B tool set
    """
    tier_lower = tier.lower() if tier else ""
    
    if tier_lower == "jigga":
        # Check if using 235B model (has math_delegate for delegation)
        search_tools = get_search_tools(tier_lower)
        if "235" in model:
            return GOGGA_TOOLS + JIGGA_235B_MATH_TOOLS + search_tools + DOCUMENT_TOOLS
        return GOGGA_TOOLS + JIGGA_MATH_TOOLS + search_tools + DOCUMENT_TOOLS
    elif tier_lower == "jive":
        # JIVE gets paid tools (image + chart + video + document) but not memory
        search_tools = get_search_tools(tier_lower)
        return PAID_TIER_TOOLS + JIVE_MATH_TOOLS + search_tools + DOCUMENT_TOOLS
    elif tier_lower == "free":
        # FREE tier gets basic search only, no video, no document tool
        search_tools = get_search_tools(tier_lower)
        return UNIVERSAL_TOOLS + FREE_MATH_TOOLS + search_tools
    return []


# =============================================================================
# Tool Response Schema
# =============================================================================

@dataclass
class ToolCall:
    """Represents a tool call from the AI."""
    id: str
    name: str
    arguments: dict[str, Any]
    
    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "arguments": self.arguments
        }


@dataclass 
class ToolResult:
    """Result of executing a tool."""
    tool_call_id: str
    success: bool
    result: Any
    error: str | None = None
    
    def to_message(self) -> dict:
        """Convert to message format for API."""
        return {
            "role": "tool",
            "tool_call_id": self.tool_call_id,
            "content": str(self.result) if self.success else f"Error: {self.error}"
        }
