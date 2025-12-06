"""
GOGGA Tool Calling Module

Defines tools that the AI can call during conversations.
Tools are executed on the frontend (client-side) after the AI requests them.
"""

from .definitions import GOGGA_TOOLS, get_tool_by_name, ToolDefinition

__all__ = ["GOGGA_TOOLS", "get_tool_by_name", "ToolDefinition"]
