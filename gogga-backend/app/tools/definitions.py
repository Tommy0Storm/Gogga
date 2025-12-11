"""
GOGGA Tool Definitions

OpenAI-compatible tool schemas for Cerebras API.
These tools are called by the AI and executed on the frontend.

Tool Flow:
1. AI receives user message + tool definitions
2. AI decides to call a tool (returns tool_calls in response)
3. Backend returns tool_calls to frontend
4. Frontend executes the tool (e.g., saves to IndexedDB)
5. Frontend sends tool result back to continue conversation
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
)


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
# Chart/Visualization Tools - Execute on Frontend (Recharts)
# =============================================================================

CREATE_CHART_TOOL: ToolDefinition = {
    "type": "function",
    "function": {
        "name": "create_chart",
        "strict": True,
        "description": (
            "Create an interactive chart or graph to visualize data. "
            "Use this when the user asks for a chart, graph, or visualization of data. "
            "Provide structured data that will be rendered as an interactive chart. "
            "Supports 13+ chart types including stacked variants for multi-series data. "
            "Examples: 'Show my expenses as a pie chart', 'Graph my sales over time', "
            "'Compare Q1 vs Q2 with a stacked bar chart', 'Visualize trends as a multi-area chart'."
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
                        "Array of data points. "
                        "Single series: [{name: 'Jan', value: 100}]. "
                        "Multi-series: Use value, value2, value3, value4, value5 for up to 5 series. "
                        "Example: [{name: 'Jan', value: 100, value2: 80}, {name: 'Feb', value: 150, value2: 90}]. "
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

# Tools available to all tiers
UNIVERSAL_TOOLS: list[ToolDefinition] = [
    GENERATE_IMAGE_TOOL,
    CREATE_CHART_TOOL,
]

# All tools combined (non-math)
GOGGA_TOOLS: list[ToolDefinition] = MEMORY_TOOLS + UNIVERSAL_TOOLS

# All tools including math
ALL_TOOLS: list[ToolDefinition] = GOGGA_TOOLS + MATH_TOOLS

# Tool name to definition mapping (includes all tools)
TOOL_MAP: dict[str, ToolDefinition] = {
    tool["function"]["name"]: tool for tool in ALL_TOOLS
}


def get_tool_by_name(name: str) -> ToolDefinition | None:
    """Get a tool definition by name."""
    return TOOL_MAP.get(name)


def get_tools_for_tier(tier: str) -> list[ToolDefinition]:
    """
    Get tools available for a specific tier.
    
    - FREE: Universal tools (image, chart) + basic math (tax, conversion)
    - JIVE: Universal + stats, financial, probability, tax, conversion
    - JIGGA: All tools (memory + image + charts + all math including fraud)
    """
    tier_lower = tier.lower() if tier else ""
    
    if tier_lower == "jigga":
        return GOGGA_TOOLS + JIGGA_MATH_TOOLS  # All tools including memory + all math
    elif tier_lower == "jive":
        return UNIVERSAL_TOOLS + JIVE_MATH_TOOLS  # Image + Charts + most math
    elif tier_lower == "free":
        return UNIVERSAL_TOOLS + FREE_MATH_TOOLS  # Image + Charts + basic math
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
