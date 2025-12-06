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
            "required": ["title", "content", "category", "priority"]
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
            "required": ["memory_title", "reason"]
        }
    }
}


# =============================================================================
# All Available Tools
# =============================================================================

GOGGA_TOOLS: list[ToolDefinition] = [
    SAVE_MEMORY_TOOL,
    DELETE_MEMORY_TOOL,
]

# Tool name to definition mapping
TOOL_MAP: dict[str, ToolDefinition] = {
    tool["function"]["name"]: tool for tool in GOGGA_TOOLS
}


def get_tool_by_name(name: str) -> ToolDefinition | None:
    """Get a tool definition by name."""
    return TOOL_MAP.get(name)


def get_tools_for_tier(tier: str) -> list[ToolDefinition]:
    """
    Get tools available for a specific tier.
    
    - FREE: No tools (memory features disabled)
    - JIVE: No tools (memory features disabled)  
    - JIGGA: All tools (full memory capabilities)
    """
    if tier == "jigga":
        return GOGGA_TOOLS
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
