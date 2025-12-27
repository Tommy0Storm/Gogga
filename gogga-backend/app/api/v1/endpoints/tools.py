"""
GOGGA Tool Execution Endpoint

Handles tool execution requests from the frontend.
This allows the backend to perform complex operations like dual image generation,
math calculations, and web search.
"""

import logging
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from fastapi import APIRouter, Query

from app.tools.executor import execute_generate_image, execute_math_tool
from app.tools.search_executor import execute_search_tool
from app.tools.definitions import get_tools_for_tier, get_tool_by_name, is_server_side_tool
from app.services.veo_service import veo_service, VeoRequest
from app.core.router import UserTier

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
    - math_statistics: Statistical calculations
    - math_financial: Financial calculations
    - math_sa_tax: SA income tax calculator
    - math_probability: Probability calculations
    - math_conversion: Unit conversions
    - math_fraud_analysis: Fraud detection (JIGGA only)
    - web_search: Google search with page scraping
    - legal_search: SA legal database search
    - shopping_search: SA product/price search
    
    Frontend-only tools (save_memory, delete_memory) should NOT be called here.
    """
    try:
        logger.info(f"🔧 TOOL EXECUTE: tool={request.tool_name}, args={request.arguments}")
        
        if request.tool_name == "generate_image":
            # Execute dual image generation
            result = await execute_generate_image(
                prompt=request.arguments.get("prompt", ""),
                style=request.arguments.get("style"),
                tier=request.arguments.get("tier", "free")
            )
            return ToolExecuteResponse(success=True, result=result)
        
        elif request.tool_name == "generate_video":
            # Execute video generation (JIVE/JIGGA only)
            tier = request.arguments.get("tier", "free").lower()
            
            # FREE tier cannot generate videos
            if tier == "free":
                return ToolExecuteResponse(
                    success=False,
                    error="Video generation is only available for JIVE and JIGGA tiers. Please upgrade."
                )
            
            # Build VeoRequest from arguments
            veo_request = VeoRequest(
                prompt=request.arguments.get("prompt", ""),
                generate_audio=request.arguments.get("generate_audio", True),
                duration_seconds=request.arguments.get("duration_seconds", 6),
                aspect_ratio=request.arguments.get("aspect_ratio", "16:9"),
            )
            
            # Get user tier enum
            user_tier = UserTier(tier)
            
            # Start video generation (returns job_id immediately)
            veo_response = await veo_service.generate(
                request=veo_request,
                user_id=request.arguments.get("user_id", "anonymous"),
                user_tier=user_tier,
            )
            
            if not veo_response.success:
                return ToolExecuteResponse(success=False, error=veo_response.error)
            
            result = {
                "type": "video",
                "job_id": veo_response.job_id,
                "status": veo_response.status.value,
                "prompt": veo_response.prompt,
                "duration_seconds": veo_response.duration_seconds,
                "message": "Video generation started. This takes 30-60 seconds.",
            }
            logger.info(f"🎬 VIDEO GENERATION STARTED: job_id={veo_response.job_id}")
            return ToolExecuteResponse(success=True, result=result)
        
        elif request.tool_name in ("web_search", "legal_search", "shopping_search", "places_search"):
            # Execute search tool
            logger.info(f"🔍 SEARCH TOOL: Executing {request.tool_name}")
            result = await execute_search_tool(
                tool_name=request.tool_name,
                arguments=request.arguments,
            )
            # Add type for frontend rendering
            result["type"] = "search"
            result["tool_name"] = request.tool_name
            logger.info(f"🔍 SEARCH TOOL SUCCESS: results={result.get('results_count', result.get('places_count', 0))}, cached={result.get('cached', False)}")
            return ToolExecuteResponse(success=result.get("success", False), result=result)
        
        elif request.tool_name.startswith("math_") or request.tool_name in ("python_execute", "sequential_think"):
            # Execute math tool, python executor, or sequential thinking
            logger.info(f"🔧 MATH/PYTHON/THINKING TOOL: Executing {request.tool_name}")
            tier = request.arguments.pop("tier", "free") if "tier" in request.arguments else "free"
            logger.debug(f"🔧 MATH/PYTHON/THINKING TOOL: tier={tier}, args={request.arguments}")
            result = await execute_math_tool(
                tool_name=request.tool_name,
                arguments=request.arguments,
                tier=tier
            )
            # Convert MathResult dataclass to dict if needed
            if hasattr(result, '__dict__') and not isinstance(result, dict):
                result = {
                    "type": "math",  # Required for frontend to render MathResultDisplay
                    "success": result.success,
                    "data": result.data,
                    "display_type": result.display_type,
                    "error": result.error
                }
            # Handle python_execute results (already a dict)
            if request.tool_name == "python_execute":
                result["type"] = "python_terminal"
            elif request.tool_name == "sequential_think":
                result["type"] = "sequential_thinking"
            logger.info(f"🔧 MATH/PYTHON/THINKING TOOL SUCCESS: result_type={result.get('display_type')}, success={result.get('success')}")
            return ToolExecuteResponse(success=result.get("success", True), result=result)
        
        elif request.tool_name == "generate_document":
            # Execute document generation
            logger.info(f"📄 DOCUMENT TOOL: Executing generate_document")
            from app.tools.document_executor import execute_document_tool
            
            tier = request.arguments.get("tier", "free")
            result = await execute_document_tool(
                arguments=request.arguments,
                user_tier=tier,
                user_id=request.arguments.get("user_id", "document_tool"),
            )
            
            if result.get("success"):
                logger.info(f"📄 DOCUMENT TOOL SUCCESS: title={result.get('result', {}).get('title', 'N/A')}")
            else:
                logger.warning(f"📄 DOCUMENT TOOL FAILED: {result.get('error')}")
            
            return ToolExecuteResponse(success=result.get("success", False), result=result.get("result"), error=result.get("error"))
        
        elif request.tool_name == "upscale_image":
            # Execute premium image upscaling (Imagen 4 Ultra)
            logger.info(f"🔍 UPSCALE IMAGE TOOL: Executing for tier={request.arguments.get('tier', 'unknown')}")
            from app.tools.executor import execute_upscale_image
            
            tier = request.arguments.get("tier", "free")
            result = await execute_upscale_image(
                source_image_id=request.arguments.get("source_image_id", ""),
                upscale_factor=request.arguments.get("upscale_factor", "x2"),
                tier=tier,
            )
            
            if result.get("success"):
                logger.info(f"🔍 UPSCALE IMAGE READY: factor={result.get('upscale_factor')}")
            else:
                logger.warning(f"🔍 UPSCALE IMAGE FAILED: {result.get('error')}")
            
            return ToolExecuteResponse(success=result.get("success", False), result=result, error=result.get("error"))
        
        elif request.tool_name == "edit_image":
            # Execute premium image editing (Imagen 3.0)
            logger.info(f"✏️ EDIT IMAGE TOOL: Executing mode={request.arguments.get('edit_mode', 'unknown')}")
            from app.tools.executor import execute_edit_image
            
            tier = request.arguments.get("tier", "free")
            result = await execute_edit_image(
                source_image_id=request.arguments.get("source_image_id", ""),
                edit_prompt=request.arguments.get("edit_prompt", ""),
                edit_mode=request.arguments.get("edit_mode", "INPAINT_INSERTION"),
                mask_description=request.arguments.get("mask_description"),
                tier=tier,
            )
            
            if result.get("success"):
                logger.info(f"✏️ EDIT IMAGE READY: mode={result.get('edit_mode')}")
            else:
                logger.warning(f"✏️ EDIT IMAGE FAILED: {result.get('error')}")
            
            return ToolExecuteResponse(success=result.get("success", False), result=result, error=result.get("error"))
        
        else:
            return ToolExecuteResponse(
                success=False,
                error=f"Unknown tool: {request.tool_name}. Supported: generate_image, generate_video, generate_document, upscale_image, edit_image, math_*, python_execute, sequential_think, *_search"
            )
            
    except Exception as e:
        logger.error(f"Tool execution failed: {e}")
        return ToolExecuteResponse(success=False, error=str(e))



# =============================================================================
# Tool Listing Endpoint (for ToolShed UI)
# =============================================================================

# Mapping of tool names to categories and examples
TOOL_METADATA = {
    "math_statistics": {
        "category": "math",
        "examples": [
            {"description": "Summary stats", "params": {"operation": "summary", "data": [10, 20, 30, 40, 50]}},
            {"description": "Find outliers", "params": {"operation": "outliers", "data": [1, 2, 3, 100, 4, 5]}},
        ]
    },
    "math_financial": {
        "category": "math",
        "examples": [
            {"description": "Compound interest", "params": {"operation": "compound_interest", "principal": 10000, "rate": 0.08, "periods": 10}},
            {"description": "Loan payment", "params": {"operation": "loan_payment", "principal": 500000, "rate": 0.105, "periods": 240}},
            {"description": "Savings goal", "params": {"operation": "goal_savings", "goal_amount": 100000, "rate": 0.08, "periods": 10}},
        ]
    },
    "math_sa_tax": {
        "category": "math",
        "examples": [
            {"description": "R500k salary", "params": {"annual_income": 500000, "age": 35}},
            {"description": "R1M salary", "params": {"annual_income": 1000000, "age": 45}},
        ]
    },
    "math_probability": {
        "category": "math",
        "examples": [
            {"description": "Coin flips", "params": {"operation": "binomial", "n": 10, "p": 0.5, "k": 6}},
            {"description": "Dice combos", "params": {"operation": "combinations", "n": 6, "r": 2}},
        ]
    },
    "math_conversion": {
        "category": "math",
        "examples": [
            {"description": "USD to ZAR", "params": {"operation": "currency", "value": 100, "from_unit": "usd", "to_unit": "zar"}},
            {"description": "km to miles", "params": {"operation": "length", "value": 100, "from_unit": "km", "to_unit": "mi"}},
        ]
    },
    "math_fraud_analysis": {
        "category": "math",
        "examples": [
            {"description": "Benford's Law", "params": {"operation": "benfords_law", "data": [123, 456, 789, 234, 567]}},
            {"description": "Anomalies", "params": {"operation": "anomaly_detection", "data": [10, 11, 12, 100, 13, 14]}},
        ]
    },
    "python_execute": {
        "category": "math",
        "examples": [
            {"description": "Precise decimals", "params": {"code": "from decimal import Decimal\nresult = Decimal.from_number(0.1) + Decimal.from_number(0.2)\nprint(f'0.1 + 0.2 = {result}')", "description": "Precise decimal arithmetic using Python 3.14"}},
            {"description": "Fractions", "params": {"code": "from fractions import Fraction\nf = Fraction.from_number(0.75)\nprint(f'0.75 as fraction: {f}')", "description": "Convert float to fraction"}},
            {"description": "Custom formula", "params": {"code": "import math\nfor n in range(1, 6):\n    print(f'√{n} = {math.sqrt(n):.6f}')", "description": "Square roots table"}},
            {"description": "Statistics", "params": {"code": "import statistics\ndata = [12, 15, 18, 22, 25, 28, 31]\nprint(f'Mean: {statistics.mean(data):.2f}')\nprint(f'Stdev: {statistics.stdev(data):.2f}')", "description": "Statistical analysis"}},
            {"description": "Number formatting", "params": {"code": "pi = 3.14159265358979\nprint(f'Pi: {pi:,.6f}')\nbig = 1234567890.123456\nprint(f'Big: {big:,.2f}')", "description": "Number formatting with separators"}},
        ]
    },
    "create_chart": {
        "category": "visualization",
        "examples": [
            {"description": "Line chart", "params": {"chart_type": "line", "title": "Growth", "data": [{"name": "Jan", "value": 100}]}},
            {"description": "Pie chart", "params": {"chart_type": "pie", "title": "Budget", "data": [{"name": "Rent", "value": 50}]}},
        ]
    },
    "generate_image": {
        "category": "creative",
        "examples": [
            {"description": "Landscape", "params": {"prompt": "Beautiful South African landscape with mountains"}},
            {"description": "Portrait", "params": {"prompt": "Professional portrait, studio lighting"}},
        ]
    },
    "save_memory": {
        "category": "memory",
        "examples": [
            {"description": "Save name", "params": {"title": "User name", "content": "John", "category": "personal", "priority": 10}},
        ]
    },
    "delete_memory": {
        "category": "memory",
        "examples": [
            {"description": "Forget name", "params": {"memory_title": "User name", "reason": "Incorrect"}},
        ]
    },
}

# Tier requirements for each tool
TOOL_TIERS = {
    "math_statistics": "jive",
    "math_financial": "jive",
    "math_sa_tax": "free",
    "math_probability": "jive",
    "math_conversion": "free",
    "math_fraud_analysis": "jigga",
    "create_chart": "free",
    "generate_image": "free",
    "save_memory": "jigga",
    "delete_memory": "jigga",
}


@router.get("")
async def list_tools(tier: str = Query("free", description="User tier (free, jive, jigga)")):
    """
    List all tools available for a tier.
    Used by frontend ToolShed panel.
    """
    tools_for_tier = get_tools_for_tier(tier)
    
    result_tools = []
    for tool_def in tools_for_tier:
        name = tool_def["function"]["name"]
        metadata = TOOL_METADATA.get(name, {})
        
        result_tools.append({
            "name": name,
            "category": metadata.get("category", "other"),
            "description": tool_def["function"]["description"],
            "tierRequired": TOOL_TIERS.get(name, "free"),
            "parameters": tool_def["function"]["parameters"],
            "examples": metadata.get("examples", []),
            "avgLatencyMs": 50 if name.startswith("math_") else 200,
        })
    
    return {
        "tools": result_tools,
        "tier": tier,
        "total": len(result_tools)
    }


@router.get("/{tool_name}")
async def get_tool_details(tool_name: str):
    """Get detailed information about a specific tool."""
    tool = get_tool_by_name(tool_name)
    if not tool:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"Tool not found: {tool_name}")
    
    metadata = TOOL_METADATA.get(tool_name, {})
    
    return {
        "name": tool_name,
        "category": metadata.get("category", "other"),
        "description": tool["function"]["description"],
        "tierRequired": TOOL_TIERS.get(tool_name, "free"),
        "parameters": tool["function"]["parameters"],
        "examples": metadata.get("examples", []),
    }
