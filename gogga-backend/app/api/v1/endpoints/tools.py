"""
GOGGA Tool Execution Endpoint

Handles tool execution requests from the frontend.
This allows the backend to perform complex operations like dual image generation.
"""

import logging
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from app.tools.executor import execute_generate_image

logger = logging.getLogger(__name__)
router = APIRouter()


class ToolExecuteRequest(BaseModel):
    """Request model for tool execution."""
    tool_name: str
    arguments: dict[str, Any]


class ToolExecuteResponse(BaseModel):
    """Response model for tool execution."""
    success: bool
    result: dict[str, Any] | None = None
    error: str | None = None


@router.post("/execute", response_model=ToolExecuteResponse)
async def execute_tool(request: ToolExecuteRequest) -> ToolExecuteResponse:
    """
    Execute a tool on the backend.
    
    Currently supports:
    - generate_image: Dual generation (Pollinations + AI Horde)
    
    Frontend-only tools (save_memory, delete_memory) should NOT be called here.
    """
    try:
        logger.info(f"Tool execution request: {request.tool_name}")
        
        if request.tool_name == "generate_image":
            # Execute dual image generation
            result = await execute_generate_image(
                prompt=request.arguments.get("prompt", ""),
                style=request.arguments.get("style"),
                tier=request.arguments.get("tier", "free")
            )
            return ToolExecuteResponse(success=True, result=result)
        
        else:
            return ToolExecuteResponse(
                success=False,
                error=f"Unknown tool: {request.tool_name}. Only 'generate_image' is supported on backend."
            )
            
    except Exception as e:
        logger.error(f"Tool execution failed: {e}")
        return ToolExecuteResponse(success=False, error=str(e))
